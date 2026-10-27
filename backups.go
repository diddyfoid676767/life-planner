package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Backups live in data/backups: the first copy of each day (planner-DATE),
// the first copy of each hour in hourly/, and a copy of whatever was about to
// be replaced by something else (before-cloud, before-sync, before-restore,
// replaced, cloud-smaller, damaged). Settings lists them all so any of them can
// be put back with one click.

func backupDir() string { return filepath.Join(dataDir, "backups") }

// keepBackup saves b as backups/<kind>-<time>.json and keeps the newest 30 of
// that kind.
func keepBackup(kind string, b []byte) {
	if len(b) == 0 {
		return
	}
	dir := backupDir()
	if os.MkdirAll(dir, 0o755) != nil {
		return
	}
	os.WriteFile(filepath.Join(dir, kind+"-"+time.Now().Format("2006-01-02-150405")+".json"), b, 0o644)
	pruneBackups(dir, kind+"-", 30)
}

// pruneBackups deletes the oldest files named prefix* in dir beyond keep.
// Only that kind is counted, so lots of one kind never push out another.
func pruneBackups(dir, prefix string, keep int) {
	entries, _ := os.ReadDir(dir)
	var names []string
	for _, e := range entries {
		n := e.Name()
		if !e.IsDir() && strings.HasPrefix(n, prefix) && strings.HasSuffix(n, ".json") {
			names = append(names, n)
		}
	}
	sort.Strings(names)
	for i := 0; i < len(names)-keep; i++ {
		os.Remove(filepath.Join(dir, names[i]))
	}
}

type backupInfo struct {
	Name    string         `json:"name"` // relative to backups, with / between folders
	Kind    string         `json:"kind"`
	At      time.Time      `json:"at"`
	Size    int64          `json:"size"`
	Counts  map[string]int `json:"counts,omitempty"`
	Damaged bool           `json:"damaged,omitempty"`
	mod     time.Time
}

var backupRe = regexp.MustCompile(`^(.+?)-(\d{4}-\d{2}-\d{2})(?:-(\d{2})(\d{4})?)?\.json$`)

// backupName reads the kind and time from a backup's name (planner-DATE,
// planner-DATE-HH, kind-DATE-HHMMSS). The file's own time is used when it
// fits, since it's to the second; a copied folder keeps the name's time.
func backupName(name string, mod time.Time) (string, time.Time) {
	m := backupRe.FindStringSubmatch(name)
	if m == nil {
		return strings.TrimSuffix(name, ".json"), mod
	}
	kind := m[1]
	if kind == "planner" {
		kind = "daily"
	}
	layout, val := "2006-01-02", m[2]
	if m[3] != "" {
		layout, val = layout+"-15", val+"-"+m[3]
	}
	if m[4] != "" {
		layout, val = layout+"0405", val+m[4]
	}
	at, err := time.ParseInLocation(layout, val, time.Local)
	if err != nil {
		return kind, mod
	}
	span := 24 * time.Hour
	if m[4] != "" {
		span = time.Second
	} else if m[3] != "" {
		span = time.Hour
	}
	if !mod.Before(at) && mod.Before(at.Add(span)) {
		return kind, mod
	}
	return kind, at
}

// summarise counts the things people would recognise their planner by.
func summarise(b []byte) (map[string]int, bool) {
	var d struct {
		Assessments []json.RawMessage `json:"assessments"`
		Sessions    []json.RawMessage `json:"sessions"`
		Workouts    []json.RawMessage `json:"workouts"`
		Todos       []json.RawMessage `json:"todos"`
		Events      []json.RawMessage `json:"events"`
		FocusLogs   []json.RawMessage `json:"focusLogs"`
		Fit         struct {
			Gym []json.RawMessage `json:"gym"`
		} `json:"fit"`
	}
	if t := strings.TrimSpace(string(b)); !strings.HasPrefix(t, "{") || !json.Valid(b) || json.Unmarshal(b, &d) != nil {
		return nil, false
	}
	return map[string]int{
		"sacs": len(d.Assessments), "study": len(d.Sessions), "workouts": len(d.Workouts),
		"todos": len(d.Todos), "events": len(d.Events), "focus": len(d.FocusLogs), "gym": len(d.Fit.Gym),
	}, true
}

func listBackups() []backupInfo {
	var out []backupInfo
	root := backupDir()
	filepath.WalkDir(root, func(p string, e os.DirEntry, err error) error {
		if err != nil || e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			return nil
		}
		fi, err := e.Info()
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, p)
		kind, at := backupName(e.Name(), fi.ModTime())
		if strings.HasPrefix(filepath.ToSlash(rel), "hourly/") {
			kind = "hourly"
		}
		bi := backupInfo{Name: filepath.ToSlash(rel), Kind: kind, At: at, Size: fi.Size(), mod: fi.ModTime()}
		if b, err := os.ReadFile(p); err == nil {
			c, ok := summarise(b)
			bi.Counts, bi.Damaged = c, !ok
		}
		out = append(out, bi)
		return nil
	})
	sort.Slice(out, func(i, j int) bool { return out[i].At.After(out[j].At) })
	return out
}

// backupPath turns a name from the list back into a path, refusing anything
// outside the backups folder.
func backupPath(name string) (string, bool) {
	root := backupDir()
	p := filepath.Join(root, filepath.FromSlash(name))
	rel, err := filepath.Rel(root, p)
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(name) || !strings.HasSuffix(p, ".json") {
		return "", false
	}
	return p, true
}

func handleBackups(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		list := listBackups()
		mu.Unlock()
		writeJSON(w, map[string]any{"backups": list, "folder": backupDir()})
	case http.MethodPost:
		// put a backup back: the planner it replaces becomes a backup itself,
		// so a restore can always be undone
		// (only the app's own pages can send JSON here; other websites can't)
		if r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "expected application/json", http.StatusUnsupportedMediaType)
			return
		}
		var req struct {
			Name     string `json:"name"`
			Snapshot string `json:"snapshot"` // just keep the planner as it is now, e.g. before importing a file
		}
		if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req) != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if req.Snapshot != "" {
			if req.Snapshot != "before-import" {
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			mu.Lock()
			cur, _ := os.ReadFile(filepath.Join(dataDir, dataFileName))
			keepBackup(req.Snapshot, cur)
			mu.Unlock()
			writeJSON(w, map[string]any{"ok": true})
			return
		}
		p, ok := backupPath(req.Name)
		if !ok {
			http.Error(w, "not a backup", http.StatusBadRequest)
			return
		}
		b, err := os.ReadFile(p)
		if err != nil {
			http.Error(w, "that backup is gone", http.StatusNotFound)
			return
		}
		if _, ok := summarise(b); !ok {
			http.Error(w, "that backup is damaged", http.StatusUnprocessableEntity)
			return
		}
		path := filepath.Join(dataDir, dataFileName)
		mu.Lock()
		cur, _ := os.ReadFile(path)
		keepBackup("before-restore", cur)
		err = saveAtomic(path, b)
		mu.Unlock()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		log.Printf("restored backup %s", req.Name)
		dataSaved()
		writeJSON(w, map[string]any{"ok": true, "hash": hashOf(b)})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// recoverPlanner is called (holding mu) when the planner file is missing or
// can't be read as a planner. A damaged file is set aside and the newest good
// backup is put in its place, so the app opens your planner instead of an
// empty one. Returns the planner now in place, or nil if there's no backup.
func recoverPlanner(path string, cur []byte) []byte {
	if len(cur) > 0 {
		keepBackup("damaged", cur)
	}
	// the newest good copy, whichever kind (a phone copy that was refused for
	// being much emptier isn't a candidate)
	type cand struct {
		p   string
		mod time.Time
	}
	var cands []cand
	if fi, err := os.Stat(path + ".prev"); err == nil {
		cands = append(cands, cand{path + ".prev", fi.ModTime()})
	}
	for _, bi := range listBackups() {
		if !bi.Damaged && bi.Kind != "cloud-smaller" && bi.Kind != "damaged" {
			cands = append(cands, cand{filepath.Join(backupDir(), filepath.FromSlash(bi.Name)), bi.mod})
		}
	}
	sort.SliceStable(cands, func(i, j int) bool { return cands[i].mod.After(cands[j].mod) })
	for _, cd := range cands {
		c := cd.p
		b, err := os.ReadFile(c)
		if err != nil {
			continue
		}
		if _, ok := summarise(b); !ok {
			continue
		}
		if saveAtomic(path, b) != nil {
			return nil
		}
		log.Printf("planner file was missing or damaged; put back %s", c)
		plannerRecovered = filepath.Base(c)
		return b
	}
	return nil
}

var plannerRecovered string // the backup put back after a damaged planner, told to the page once

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}
