package main

// Updates from GitHub: every few hours the app asks GitHub for the latest
// release of githubRepo. When its tag (v2.11 and so on) is newer than this
// version, the LifePlanner.exe asset is downloaded next to the running exe as
// LifePlanner.new.exe, and the page offers the usual one-click update.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const githubRepo = "diddyfoid676767/life-planner"

type ghRelease struct {
	Tag    string `json:"tag_name"`
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

// newerVersion reports whether tag (like "v2.11") is a later version than cur ("2.10").
func newerVersion(tag, cur string) bool {
	a, b := strings.Split(strings.TrimPrefix(tag, "v"), "."), strings.Split(cur, ".")
	for i := 0; i < len(a) || i < len(b); i++ {
		var x, y int
		if i < len(a) {
			x, _ = strconv.Atoi(a[i])
		}
		if i < len(b) {
			y, _ = strconv.Atoi(b[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

func ghGet(url string, limit int64) ([]byte, error) {
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "LifePlanner/"+version)
	c := &http.Client{Timeout: 5 * time.Minute}
	res, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: %s", url, res.Status)
	}
	return io.ReadAll(io.LimitReader(res.Body, limit))
}

func checkGitHub() error {
	b, err := ghGet("https://api.github.com/repos/"+githubRepo+"/releases/latest", 1<<20)
	if err != nil {
		return err
	}
	var rel ghRelease
	if err := json.Unmarshal(b, &rel); err != nil {
		return err
	}
	latestTag = rel.Tag
	if !newerVersion(rel.Tag, version) {
		return nil
	}
	var exeURL, sumURL string
	for _, a := range rel.Assets {
		if !strings.HasPrefix(a.URL, "https://github.com/") {
			continue
		}
		switch strings.ToLower(a.Name) {
		case "lifeplanner.exe":
			exeURL = a.URL
		case "lifeplanner.exe.sha256":
			sumURL = a.URL
		}
	}
	if exeURL == "" {
		return nil
	}
	dest := filepath.Join(filepath.Dir(exePath()), "LifePlanner.new.exe")
	if c := findUpdate(); c != nil && c.path == dest {
		return nil // already downloaded
	}
	exe, err := ghGet(exeURL, 200<<20)
	if err != nil {
		return err
	}
	if !isPE(exe) {
		return fmt.Errorf("release %s: not a Windows exe", rel.Tag)
	}
	if sumURL != "" {
		s, err := ghGet(sumURL, 4096)
		if err != nil {
			return err
		}
		got := sha256.Sum256(exe)
		if f := strings.Fields(string(s)); len(f) == 0 || !strings.EqualFold(f[0], hex.EncodeToString(got[:])) {
			return fmt.Errorf("release %s: checksum does not match", rel.Tag)
		}
	}
	updateMu.Lock()
	defer updateMu.Unlock()
	if err := os.WriteFile(dest, exe, 0o755); err != nil {
		return err
	}
	log.Printf("downloaded %s from GitHub", rel.Tag)
	return nil
}

// latestTag is the newest release GitHub reported, for Settings → App.
var latestTag string

// watchGitHub checks for a new release shortly after start, then every 10 minutes.
func watchGitHub() {
	time.Sleep(20 * time.Second)
	for {
		if err := checkGitHub(); err != nil {
			log.Printf("github update check: %v", err)
		}
		time.Sleep(10 * time.Minute)
	}
}

// POST /api/update/check: look on GitHub now (the "Check for updates" button).
func handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	resp := map[string]any{"version": version}
	if err := checkGitHub(); err != nil {
		log.Printf("github update check: %v", err)
		resp["error"] = "Couldn't reach GitHub. Check your internet connection."
	}
	updateMu.Lock()
	resp["available"] = findUpdate() != nil
	updateMu.Unlock()
	resp["latest"] = latestTag
	json.NewEncoder(w).Encode(resp)
}
