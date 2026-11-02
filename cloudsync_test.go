package main

import (
	"encoding/json"
	"fmt"
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
	before  func() // runs before each write, to change the row "meanwhile"
}

func (f *fakeCloud) set(d string) {
	f.n++
	f.data = json.RawMessage(d)
	f.at = fmt.Sprintf("2026-10-27T08:00:%02d.%06d+00:00", f.n%60, f.n)
}

func (f *fakeCloud) meta(*account) (string, bool, error) {
	f.Lock()
	defer f.Unlock()
	return f.at, f.data != nil, nil
}

func (f *fakeCloud) get(*account) (cloudRow, bool, error) {
	f.Lock()
	defer f.Unlock()
	return cloudRow{Data: f.data, UpdatedAt: f.at}, f.data != nil, nil
}

func (f *fakeCloud) write(data []byte, ok func() bool) (string, error) {
	f.Lock()
	defer f.Unlock()
	if f.before != nil {
		b := f.before
		f.before = nil
		b()
	}
	if !ok() {
		return "", errCloudChanged
	}
	f.set(string(data))
	return f.at, nil
}

func (f *fakeCloud) create(_ *account, data []byte) (string, error) {
	return f.write(data, func() bool { return f.data == nil })
}

func (f *fakeCloud) update(_ *account, data []byte, at string) (string, error) {
	f.patches++
	return f.write(data, func() bool { return f.data != nil && f.at == at })
}

func setupSync(t *testing.T, local string, st *syncState, base string) *fakeCloud {
	t.Helper()
	f := &fakeCloud{}
	cloud = f
	t.Cleanup(func() { cloud = fsPlanner{} })
	dataDir = t.TempDir()
	saveAccount(&account{Backend: "fb", UserID: "u1", Username: "eli", Access: "a", Refresh: "r", Expires: time.Now().Unix() + 3600})
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
