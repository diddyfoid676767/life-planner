package main

// Phone sync: while you're logged in, the planner is also kept in your own row
// of planner_data on Supabase (supabase-2.29-phone-sync.sql), so the phone app
// (the same pages, hosted on GitHub Pages) opens the same planner. Each save
// here is pushed a few seconds later, and the cloud copy is checked whenever
// the page pings, so an edit made on the phone shows up here within about 20s.
// The last save wins. Nothing is synced while you're logged out.

import (
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
	syncRev   int64 // bumps when the cloud copy replaced the local file, so the page reloads its data
	syncErr   string
	syncCheck time.Time
	pushTimer *time.Timer
)

func syncPath() string { return filepath.Join(dataDir, "cloudsync.json") }

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

// cloudSync pushes local changes, or pulls the cloud copy when it is newer
// than the one this PC last saw. push skips the pull check.
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
	}
	st := syncSt
	syncMu.Unlock()
	path := filepath.Join(dataDir, dataFileName)

	setErr := func(e error) {
		syncMu.Lock()
		syncErr = ""
		if e != nil {
			syncErr = e.Error()
			log.Printf("phone sync: %v", e)
		}
		syncMu.Unlock()
	}

	if !push || st.CloudAt == "" {
		var rows []cloudRow
		q := "/rest/v1/planner_data?select=updated_at&user_id=eq." + url.QueryEscape(a.UserID)
		if _, err := supa("GET", q, a.Access, nil, &rows); err != nil {
			setErr(err)
			return
		}
		local, _ := os.Stat(path)
		newer := len(rows) > 0 && rows[0].UpdatedAt != st.CloudAt
		// the first time, the fuller of the two planners wins (so logging in
		// from a fresh copy brings your planner down instead of wiping it), and
		// the other one is kept in backups
		takeCloud := false
		if first && len(rows) > 0 && local != nil {
			var full []cloudRow
			if _, err := supa("GET", "/rest/v1/planner_data?select=data,updated_at&user_id=eq."+url.QueryEscape(a.UserID), a.Access, nil, &full); err == nil && len(full) > 0 && json.Valid(full[0].Data) {
				takeCloud = int64(len(full[0].Data)) > local.Size()
				keep := full[0].Data
				if takeCloud {
					keep, _ = os.ReadFile(path)
				}
				os.MkdirAll(filepath.Join(dataDir, "backups"), 0o755)
				os.WriteFile(filepath.Join(dataDir, "backups", "before-sync-"+time.Now().Format("2006-01-02-150405")+".json"), keep, 0o644)
			}
		}
		// the first time, this PC's planner goes up unless it has none yet
		if newer && ((st.CloudAt != "" && !st.Pending) || local == nil || takeCloud) {
			rows = nil
			if _, err := supa("GET", "/rest/v1/planner_data?select=data,updated_at&user_id=eq."+url.QueryEscape(a.UserID), a.Access, nil, &rows); err != nil || len(rows) == 0 || !json.Valid(rows[0].Data) {
				setErr(err)
				return
			}
			mu.Lock()
			err := saveAtomic(path, rows[0].Data)
			if err == nil {
				dailyBackup(rows[0].Data)
			}
			mu.Unlock()
			if err != nil {
				setErr(err)
				return
			}
			syncMu.Lock()
			syncSt.CloudAt = rows[0].UpdatedAt
			syncRev++
			saveSyncState()
			syncMu.Unlock()
			setErr(nil)
			return
		}
		if !st.Pending && !(st.CloudAt == "" && local != nil) {
			setErr(nil)
			return
		}
	}

	mu.Lock()
	b, err := os.ReadFile(path)
	mu.Unlock()
	if err != nil || !json.Valid(b) {
		return
	}
	var out []cloudRow
	body := map[string]any{"user_id": a.UserID, "data": json.RawMessage(b), "device": "pc"}
	if _, err := supa("POST", "/rest/v1/planner_data?on_conflict=user_id&select=updated_at", a.Access, body, &out,
		"Prefer", "resolution=merge-duplicates,return=representation"); err != nil {
		setErr(err)
		return
	}
	syncMu.Lock()
	if len(out) > 0 {
		syncSt.CloudAt = out[0].UpdatedAt
	}
	syncSt.Pending = false
	saveSyncState()
	syncMu.Unlock()
	setErr(nil)
}

// forgetSync drops the sync state when you log out.
func forgetSync() {
	syncMu.Lock()
	syncSt = syncState{}
	syncErr = ""
	os.Remove(syncPath())
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
