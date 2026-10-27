package main

// Self-update: a newer LifePlanner.exe can arrive either as LifePlanner.new.exe
// next to the running exe, or as a LifePlanner*.zip / LifePlanner*.exe in the
// user's Downloads folder. The page offers a one-click update, which swaps the
// exe (Windows allows renaming a running exe) and restarts on the same port.
// The data folder is never touched.

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

const version = "2.27.0"

var (
	selfHashOnce sync.Once
	selfHash     [32]byte
	updateMu     sync.Mutex
)

func exePath() string {
	exe, _ := os.Executable()
	exe, _ = filepath.EvalSymlinks(exe)
	return exe
}

func hashOfSelf() [32]byte {
	selfHashOnce.Do(func() {
		if b, err := os.ReadFile(exePath()); err == nil {
			selfHash = sha256.Sum256(b)
		}
	})
	return selfHash
}

type updateCandidate struct {
	path string
	data []byte
}

// readCandidate returns the exe bytes from an .exe or from LifePlanner.exe inside a .zip.
func readCandidate(path string) ([]byte, error) {
	if strings.EqualFold(filepath.Ext(path), ".exe") {
		return os.ReadFile(path)
	}
	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	for _, f := range zr.File {
		if strings.EqualFold(filepath.Base(f.Name), "LifePlanner.exe") {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(io.LimitReader(rc, 200<<20))
		}
	}
	return nil, os.ErrNotExist
}

func isPE(b []byte) bool {
	if runtime.GOOS != "windows" {
		return len(b) > 1024
	}
	return len(b) > 1024 && bytes.HasPrefix(b, []byte("MZ"))
}

func findUpdate() *updateCandidate {
	self := exePath()
	st, err := os.Stat(self)
	if err != nil {
		return nil
	}
	selfMod := st.ModTime()
	cands := []string{filepath.Join(filepath.Dir(self), "LifePlanner.new.exe")}
	if home, err := os.UserHomeDir(); err == nil {
		dl := filepath.Join(home, "Downloads")
		for _, pat := range []string{"LifePlanner*.zip", "LifePlanner*.exe"} {
			m, _ := filepath.Glob(filepath.Join(dl, pat))
			sort.Slice(m, func(i, j int) bool { return modTime(m[i]).After(modTime(m[j])) })
			for _, p := range m {
				if modTime(p).After(selfMod) {
					cands = append(cands, p)
				}
			}
		}
	}
	for _, p := range cands {
		if _, err := os.Stat(p); err != nil {
			continue
		}
		b, err := readCandidate(p)
		if err != nil || !isPE(b) {
			continue
		}
		if sha256.Sum256(b) == hashOfSelf() {
			continue
		}
		return &updateCandidate{path: p, data: b}
	}
	return nil
}

func modTime(p string) time.Time {
	if st, err := os.Stat(p); err == nil {
		return st.ModTime()
	}
	return time.Time{}
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	updateMu.Lock()
	defer updateMu.Unlock()
	c := findUpdate()
	if r.Method == http.MethodGet {
		resp := map[string]any{"version": version, "available": c != nil}
		if c != nil {
			resp["source"] = c.path
		}
		json.NewEncoder(w).Encode(resp)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if c == nil {
		http.Error(w, "no update found", http.StatusNotFound)
		return
	}
	self := exePath()
	dir := filepath.Dir(self)
	staged := filepath.Join(dir, "LifePlanner.staged.exe")
	old := filepath.Join(dir, "LifePlanner.old.exe")
	if err := os.WriteFile(staged, c.data, 0o755); err != nil {
		http.Error(w, "could not write update: "+err.Error(), http.StatusInternalServerError)
		return
	}
	os.Remove(old)
	if err := os.Rename(self, old); err != nil {
		os.Remove(staged)
		http.Error(w, "could not replace the app: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := os.Rename(staged, self); err != nil {
		os.Rename(old, self)
		http.Error(w, "could not install update: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if strings.EqualFold(filepath.Base(c.path), "LifePlanner.new.exe") {
		os.Remove(c.path)
	}
	log.Printf("updated from %s", c.path)
	w.Write([]byte(`{"ok":true}`))
	go func() {
		time.Sleep(300 * time.Millisecond)
		cmd := exec.Command(self, "--restarted")
		cmd.Dir = dir
		if err := cmd.Start(); err != nil {
			log.Printf("restart failed: %v", err)
		}
		os.Exit(0)
	}()
}

// cleanupOld removes the previous exe left behind by an update.
func cleanupOld() {
	old := filepath.Join(filepath.Dir(exePath()), "LifePlanner.old.exe")
	for i := 0; i < 10; i++ {
		if err := os.Remove(old); err == nil || os.IsNotExist(err) {
			return
		}
		time.Sleep(2 * time.Second)
	}
}
