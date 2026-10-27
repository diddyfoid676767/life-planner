package main

// Phone sync: while you're logged in, the planner is also kept in your own row
// of planner_data on Supabase (supabase-2.29-phone-sync.sql), so the phone app
// (the same pages, hosted on GitHub Pages) opens the same planner. Each save
// here is pushed a few seconds later, and the cloud copy is checked whenever
// the page pings, so an edit made on the phone shows up here within about 20s.
// When both changed since they last synced, the two are merged item by item
// (mergePlanner), using the copy they last agreed on (cloudsync-base.json), so
// neither side's changes are lost. Nothing is synced while you're logged out.

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type syncState struct {
	CloudAt string `json:"cloud_at"` // updated_at of the cloud copy last written or read here
	Pending bool   `json:"pending"`  // local changes not pushed yet
	User    string `json:"user"`
}

var (
	syncMu    sync.Mutex
	syncSt    syncState
	syncRev   int64 // bumps when the cloud copy changed the local file, so the page reloads its data
	syncErr   string
	syncCheck time.Time
	saveGen   int64 // bumps on every local save, so a push knows if another save came in meanwhile
	pushTimer *time.Timer
)

func syncPath() string { return filepath.Join(dataDir, "cloudsync.json") }

// syncBasePath holds the copy the cloud had when this PC last synced: the
// starting point both sides' changes are measured from when merging.
func syncBasePath() string { return filepath.Join(dataDir, "cloudsync-base.json") }

func loadSyncState() {
	b, _ := os.ReadFile(syncPath())
	json.Unmarshal(b, &syncSt)
}

func saveSyncState() {
	b, _ := json.Marshal(syncSt)
	os.WriteFile(syncPath(), b, 0o644)
}

// syncInfo is what Settings shows about the phone sync.
func syncInfo() map[string]any {
	syncMu.Lock()
	defer syncMu.Unlock()
	return map[string]any{"at": syncSt.CloudAt, "pending": syncSt.Pending, "error": syncErr}
}

// dataSaved is called after the page saves; the push waits a few seconds so a
// burst of edits goes up once.
func dataSaved() {
	syncMu.Lock()
	defer syncMu.Unlock()
	syncSt.Pending = true
	saveGen++
	saveSyncState()
	if pushTimer != nil {
		pushTimer.Stop()
	}
	pushTimer = time.AfterFunc(4*time.Second, func() { cloudSync(true) })
}

// cloudCheck is called on every page ping; it looks at the cloud at most every 15s.
func cloudCheck() {
	syncMu.Lock()
	due := time.Since(syncCheck) > 15*time.Second
	if due {
		syncCheck = time.Now()
	}
	syncMu.Unlock()
	if due {
		go cloudSync(false)
	}
}

type cloudRow struct {
	Data      json.RawMessage `json:"data"`
	UpdatedAt string          `json:"updated_at"`
}

var syncRun sync.Mutex // one sync at a time

// cloudSync brings in the cloud copy when it changed since this PC last saw
// it (merging it with any changes made here), then pushes local changes.
// push skips the first look at the cloud: the push itself only goes through
// if the cloud copy is still the one this PC last saw.
func cloudSync(push bool) {
	syncRun.Lock()
	defer syncRun.Unlock()
	a, err := session()
	if err != nil {
		return
	}
	syncMu.Lock()
	first := syncSt.User != a.UserID
	if first { // first sync for this account on this PC (or this folder)
		syncSt = syncState{User: a.UserID, Pending: true}
		os.Remove(syncBasePath())
		saveSyncState()
	}
	syncMu.Unlock()

	setErr := func(e error) {
		syncMu.Lock()
		syncErr = ""
		if e != nil {
			syncErr = e.Error()
			log.Printf("phone sync: %v", e)
		}
		syncMu.Unlock()
	}
	user := url.QueryEscape(a.UserID)
	look := !push || first
	for try := 0; try < 4; try++ {
		if look {
			var rows []cloudRow
			if _, err := supa("GET", "/rest/v1/planner_data?select=updated_at&user_id=eq."+user, a.Access, nil, &rows); err != nil {
				setErr(err)
				return
			}
			syncMu.Lock()
			seen := syncSt.CloudAt
			syncMu.Unlock()
			if len(rows) > 0 && (rows[0].UpdatedAt != seen || first) {
				rows = nil
				if _, err := supa("GET", "/rest/v1/planner_data?select=data,updated_at&user_id=eq."+user, a.Access, nil, &rows); err != nil {
					setErr(err)
					return
				}
				if len(rows) == 0 || !json.Valid(rows[0].Data) {
					setErr(nil)
					return
				}
				if err := takeCloud(rows[0], first); err != nil {
					setErr(err)
					return
				}
				first = false
			}
		}
		look = true
		syncMu.Lock()
		st, gen := syncSt, saveGen
		syncMu.Unlock()
		if !st.Pending {
			setErr(nil)
			return
		}
		done, err := pushLocal(a, st.CloudAt, gen)
		if err != nil {
			setErr(err)
			return
		}
		if done {
			setErr(nil)
			return
		}
		// the cloud copy changed since: bring it in and try again
	}
}

// takeCloud brings the cloud copy into the planner here: as it is when
// nothing changed here since the last sync, otherwise merged with the changes
// made here. The planner it changes is kept in backups first.
func takeCloud(row cloudRow, first bool) error {
	path := filepath.Join(dataDir, dataFileName)
	mu.Lock()
	defer mu.Unlock()
	syncMu.Lock()
	pending := syncSt.Pending
	syncMu.Unlock()
	local, _ := os.ReadFile(path)
	cloud := []byte(row.Data)
	result := cloud
	if len(local) > 0 && json.Valid(local) {
		base, _ := os.ReadFile(syncBasePath())
		if len(base) == 0 && !pending && !first {
			base = local // synced by an older version: nothing changed here since
		}
		if first {
			base = nil // the first time, nothing is deleted: both planners' items are kept
			keepBackup("before-sync", cloud)
		}
		// a much emptier cloud copy can't delete things here: keep everything
		if len(local) > 20<<10 && len(cloud) < len(local)/3 {
			keepBackup("cloud-smaller", cloud)
			log.Printf("phone sync: cloud copy (%d bytes) much smaller than this PC's (%d), keeping everything from both", len(cloud), len(local))
			base = nil
		}
		if len(base) == 0 || !sameJSON(local, base) {
			m, err := mergePlanner(base, local, cloud)
			if err != nil {
				return err
			}
			result = m
		}
	}
	if !bytes.Equal(result, local) && !sameJSON(result, local) {
		if len(local) > 0 {
			keepBackup("before-cloud", local)
		}
		if err := saveAtomic(path, result); err != nil {
			return err
		}
		dailyBackup(result)
		syncMu.Lock()
		syncRev++
		syncMu.Unlock()
	}
	os.WriteFile(syncBasePath(), cloud, 0o644)
	syncMu.Lock()
	syncSt.CloudAt = row.UpdatedAt
	syncSt.Pending = !sameJSON(result, cloud)
	saveSyncState()
	syncMu.Unlock()
	return nil
}

func sameJSON(a, b []byte) bool {
	if bytes.Equal(a, b) {
		return true
	}
	x, e1 := decodeJSON(a)
	y, e2 := decodeJSON(b)
	return e1 == nil && e2 == nil && sameVal(x, y)
}

// pushLocal uploads the planner here, but only over the cloud copy this PC
// last saw (cloudAt): false means the cloud changed since and nothing was
// written.
func pushLocal(a *account, cloudAt string, gen int64) (bool, error) {
	path := filepath.Join(dataDir, dataFileName)
	mu.Lock()
	b, err := os.ReadFile(path)
	mu.Unlock()
	if err != nil || !json.Valid(b) {
		return true, nil
	}
	user := url.QueryEscape(a.UserID)
	body := map[string]any{"user_id": a.UserID, "data": json.RawMessage(b), "device": "pc"}
	var out []cloudRow
	if cloudAt == "" { // no cloud copy yet: only create one
		code, err := supa("POST", "/rest/v1/planner_data?select=updated_at", a.Access, body, &out, "Prefer", "return=representation")
		if code == http.StatusConflict {
			return false, nil
		}
		if err != nil {
			return false, err
		}
	} else {
		if _, err := supa("PATCH", "/rest/v1/planner_data?select=updated_at&user_id=eq."+user+"&updated_at=eq."+url.QueryEscape(cloudAt), a.Access,
			map[string]any{"data": json.RawMessage(b), "device": "pc"}, &out, "Prefer", "return=representation"); err != nil {
			return false, err
		}
		if len(out) == 0 {
			// nothing matched: someone saved since, unless the time just didn't
			// match as text, in which case the copy is still the one seen here
			var rows []cloudRow
			if _, err := supa("GET", "/rest/v1/planner_data?select=updated_at&user_id=eq."+user, a.Access, nil, &rows); err != nil {
				return false, err
			}
			if len(rows) == 0 || rows[0].UpdatedAt != cloudAt {
				return false, nil
			}
			if _, err := supa("POST", "/rest/v1/planner_data?on_conflict=user_id&select=updated_at", a.Access, body, &out,
				"Prefer", "resolution=merge-duplicates,return=representation"); err != nil {
				return false, err
			}
		}
	}
	os.WriteFile(syncBasePath(), b, 0o644)
	syncMu.Lock()
	if len(out) > 0 {
		syncSt.CloudAt = out[0].UpdatedAt
	}
	syncSt.Pending = saveGen != gen // saved again while this went up: push that too
	saveSyncState()
	syncMu.Unlock()
	return true, nil
}

// forgetSync drops the sync state when you log out.
func forgetSync() {
	syncMu.Lock()
	syncSt = syncState{}
	syncErr = ""
	os.Remove(syncPath())
	os.Remove(syncBasePath())
	syncMu.Unlock()
}

func currentRev() int64 {
	syncMu.Lock()
	defer syncMu.Unlock()
	return syncRev
}

// staleRev is true when a save comes from a page that hasn't loaded the copy
// pulled from the phone yet.
func staleRev(r *http.Request) bool {
	h := r.Header.Get("X-Planner-Rev")
	return h != "" && h != jsonInt(currentRev())
}

func jsonInt(n int64) string { b, _ := json.Marshal(n); return string(b) }
