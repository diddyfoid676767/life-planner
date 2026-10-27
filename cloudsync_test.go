package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeCloud stands in for the planner_data table: one row, conditional
// updates on updated_at like PostgREST.
type fakeCloud struct {
	sync.Mutex
	data    json.RawMessage
	at      string
	n       int
	patches int
	noMatch bool
	before  func() // runs before each write, to change the row "meanwhile"
}

func (f *fakeCloud) set(d string) {
	f.n++
	f.data = json.RawMessage(d)
	f.at = fmt.Sprintf("2026-10-27T08:00:%02d.%06d+00:00", f.n%60, f.n)
}

func (f *fakeCloud) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.Lock()
	defer f.Unlock()
	q := r.URL.Query()
	row := func() []map[string]any {
		if f.data == nil {
			return []map[string]any{}
		}
		m := map[string]any{"updated_at": f.at}
		if strings.Contains(q.Get("select"), "data") {
			m["data"] = f.data
		}
		return []map[string]any{m}
	}
	var body struct {
		Data json.RawMessage `json:"data"`
	}
	if r.Method != "GET" {
		if f.before != nil {
			b := f.before
			f.before = nil
			b()
		}
		raw, _ := io.ReadAll(r.Body)
		json.Unmarshal(raw, &body)
	}
	switch r.Method {
	case "GET":
		json.NewEncoder(w).Encode(row())
	case "POST":
		if f.data != nil && !strings.Contains(r.Header.Get("Prefer"), "merge-duplicates") {
			w.WriteHeader(409)
			w.Write([]byte(`{"message":"duplicate key"}`))
			return
		}
		f.set(string(body.Data))
		json.NewEncoder(w).Encode(row())
	case "PATCH":
		f.patches++
		if f.data == nil || f.noMatch || q.Get("updated_at") != "eq."+f.at {
			w.Write([]byte("[]"))
			return
		}
		f.set(string(body.Data))
		json.NewEncoder(w).Encode(row())
	}
}

func setupSync(t *testing.T, local string, st *syncState, base string) *fakeCloud {
	t.Helper()
	f := &fakeCloud{}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	supaURL, supaKey = srv.URL, "k"
	dataDir = t.TempDir()
	saveAccount(&account{UserID: "u1", Username: "eli", Access: "a", Refresh: "r", Expires: time.Now().Unix() + 3600})
	if local != "" {
		os.WriteFile(filepath.Join(dataDir, dataFileName), []byte(local), 0o644)
	}
	if base != "" {
		os.WriteFile(syncBasePath(), []byte(base), 0o644)
	}
	syncSt = syncState{}
	if st != nil {
		syncSt = *st
	}
	return f
}

func localPlanner(t *testing.T) any {
	b, err := os.ReadFile(filepath.Join(dataDir, dataFileName))
	if err != nil {
		t.Fatal(err)
	}
	v, _ := decodeJSON(b)
	return v
}

func ids(t *testing.T, v any) string {
	var out []string
	for _, x := range v.(map[string]any)["todos"].([]any) {
		out = append(out, x.(map[string]any)["id"].(string))
	}
	return strings.Join(out, ",")
}

func cloudIDs(t *testing.T, f *fakeCloud) string {
	v, _ := decodeJSON(f.data)
	return ids(t, v)
}

const p0 = `{"todos":[{"id":"a"},{"id":"b"}]}`

func TestSyncPendingMergesWithNewerCloud(t *testing.T) {
	f := setupSync(t, `{"todos":[{"id":"a"},{"id":"b"},{"id":"pc"}]}`, nil, p0)
	f.set(p0)
	syncSt = syncState{User: "u1", CloudAt: f.at, Pending: true}
	f.set(`{"todos":[{"id":"a"},{"id":"phone"}]}`) // the phone deleted b and added one
	cloudSync(false)
	if got := ids(t, localPlanner(t)); got != "a,phone,pc" {
		t.Fatalf("local %s", got)
	}
	if got := cloudIDs(t, f); got != "a,phone,pc" {
		t.Fatalf("cloud %s", got)
	}
	if syncSt.Pending || syncSt.CloudAt != f.at {
		t.Fatalf("state %+v", syncSt)
	}
	if b, _ := os.ReadFile(syncBasePath()); !sameJSON(b, f.data) {
		t.Fatal("base not updated")
	}
}

func TestSyncPushOnlyOverSeenCopy(t *testing.T) {
	// the phone saves between the PC's look and its push
	f := setupSync(t, `{"todos":[{"id":"a"},{"id":"b"},{"id":"pc"}]}`, nil, p0)
	f.set(p0)
	syncSt = syncState{User: "u1", CloudAt: f.at, Pending: true}
	f.before = func() { f.set(`{"todos":[{"id":"b"},{"id":"phone"}]}`) }
	cloudSync(true)
	if got := cloudIDs(t, f); got != "b,phone,pc" {
		t.Fatalf("cloud %s", got)
	}
	if got := ids(t, localPlanner(t)); got != "b,phone,pc" {
		t.Fatalf("local %s", got)
	}
}

func TestSyncMigrationNotPendingTakesCloud(t *testing.T) {
	// synced by 2.32.5 (no base kept), nothing changed here: the cloud copy is taken as it is
	f := setupSync(t, p0, nil, "")
	f.set(p0)
	syncSt = syncState{User: "u1", CloudAt: f.at}
	f.set(`{"todos":[{"id":"a"}]}`)
	cloudSync(false)
	if got := ids(t, localPlanner(t)); got != "a" {
		t.Fatalf("local %s", got)
	}
	if syncSt.Pending {
		t.Fatal("still pending")
	}
}

func TestSyncMigrationPendingKeepsBoth(t *testing.T) {
	// 2.32.5 left changes waiting and no base: nothing from either side is lost
	f := setupSync(t, `{"todos":[{"id":"a"},{"id":"pc"}]}`, nil, "")
	f.set(p0)
	syncSt = syncState{User: "u1", CloudAt: f.at, Pending: true}
	f.set(`{"todos":[{"id":"a"},{"id":"b"},{"id":"phone"}]}`)
	cloudSync(false)
	if got := ids(t, localPlanner(t)); got != "a,b,phone,pc" {
		t.Fatalf("local %s", got)
	}
	if got := cloudIDs(t, f); got != "a,b,phone,pc" {
		t.Fatalf("cloud %s", got)
	}
}

func TestSyncFirstTimeKeepsBoth(t *testing.T) {
	f := setupSync(t, `{"todos":[{"id":"pc"}]}`, nil, "")
	f.set(`{"todos":[{"id":"phone"}]}`)
	cloudSync(false)
	if got := cloudIDs(t, f); got != "phone,pc" {
		t.Fatalf("cloud %s", got)
	}
	if got := ids(t, localPlanner(t)); got != "phone,pc" {
		t.Fatalf("local %s", got)
	}
	if n, _ := filepath.Glob(filepath.Join(dataDir, "backups", "before-sync-*")); len(n) != 1 {
		t.Fatal("no before-sync backup")
	}
}

func TestSyncFirstTimeNoCloud(t *testing.T) {
	f := setupSync(t, p0, nil, "")
	cloudSync(false)
	if got := cloudIDs(t, f); got != "a,b" {
		t.Fatalf("cloud %s", got)
	}
}

func TestSyncFirstTimeNoLocal(t *testing.T) {
	f := setupSync(t, "", nil, "")
	f.set(p0)
	cloudSync(false)
	if got := ids(t, localPlanner(t)); got != "a,b" {
		t.Fatalf("local %s", got)
	}
}

func TestSyncEmptyCloudDeletesNothing(t *testing.T) {
	var big strings.Builder
	big.WriteString(`{"todos":[`)
	for i := 0; i < 800; i++ {
		if i > 0 {
			big.WriteString(",")
		}
		fmt.Fprintf(&big, `{"id":"t%d","text":"something to do number %d"}`, i, i)
	}
	big.WriteString(`]}`)
	f := setupSync(t, big.String(), nil, big.String())
	f.set(big.String())
	syncSt = syncState{User: "u1", CloudAt: f.at}
	f.set(`{"todos":[{"id":"new"}]}`) // a nearly empty planner went up from somewhere
	cloudSync(false)
	v := localPlanner(t).(map[string]any)["todos"].([]any)
	if len(v) != 801 {
		t.Fatalf("local has %d todos", len(v))
	}
	if n, _ := filepath.Glob(filepath.Join(dataDir, "backups", "cloud-smaller-*")); len(n) != 1 {
		t.Fatal("no cloud-smaller backup")
	}
}

func TestSyncPlainPushAndPull(t *testing.T) {
	f := setupSync(t, p0, nil, "")
	cloudSync(false)
	at := f.at
	// a save here goes up as a conditional update
	os.WriteFile(filepath.Join(dataDir, dataFileName), []byte(`{"todos":[{"id":"a"}]}`), 0o644)
	syncSt.Pending = true
	cloudSync(true)
	if f.at == at || cloudIDs(t, f) != "a" || f.patches != 1 {
		t.Fatalf("push: %s %d", cloudIDs(t, f), f.patches)
	}
	// nothing changed anywhere: nothing happens
	n := f.n
	cloudSync(false)
	if f.n != n {
		t.Fatal("wrote without changes")
	}
	// a phone save comes down as it is
	f.set(`{"todos":[{"id":"z"}]}`)
	rev := currentRev()
	cloudSync(false)
	if ids(t, localPlanner(t)) != "z" || currentRev() == rev || syncSt.Pending {
		t.Fatal("pull")
	}
}

func TestSyncTimeTextMismatch(t *testing.T) {
	// the update's time filter never matches (the time printed differently),
	// but the copy is still the one seen here, so the push still goes through
	f := setupSync(t, `{"todos":[{"id":"a"},{"id":"b"},{"id":"c"}]}`, nil, p0)
	f.set(p0)
	syncSt = syncState{User: "u1", CloudAt: f.at, Pending: true}
	f.noMatch = true
	cloudSync(true)
	if cloudIDs(t, f) != "a,b,c" || syncSt.Pending {
		t.Fatal("not pushed")
	}
}
