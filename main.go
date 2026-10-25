// Life Planner: a portable, single-exe planner. It serves an embedded web UI on
// localhost, opens it in the default browser, and stores everything in a JSON
// file next to the executable so the whole folder can live on a USB stick.
package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed web
var webFS embed.FS

// port can be moved with LP_PORT, so two copies can run side by side for testing
var port = func() int {
	if p, err := strconv.Atoi(os.Getenv("LP_PORT")); err == nil && p > 0 {
		return p
	}
	return 47823
}()

const (
	dataFileName = "planner-data.json"
	idleTimeout  = 3 * time.Minute // quit when no browser tab has checked in for this long
)

var (
	bootID   = fmt.Sprint(time.Now().UnixNano())
	dataDir  string
	mu       sync.Mutex
	lastPing = time.Now()
	pingMu   sync.Mutex
)

func main() {
	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	exe, _ = filepath.EvalSymlinks(exe)
	dataDir = filepath.Join(filepath.Dir(exe), "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal(err)
	}
	if f, err := os.OpenFile(filepath.Join(dataDir, "planner.log"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644); err == nil {
		log.SetOutput(f)
	}

	url := fmt.Sprintf("http://127.0.0.1:%d/", port)

	restarted := len(os.Args) > 1 && os.Args[1] == "--restarted"
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	// after a self-update the old process may still hold the port for a moment
	for i := 0; err != nil && restarted && i < 40; i++ {
		time.Sleep(250 * time.Millisecond)
		ln, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	}
	if err != nil && takeOverOtherCopy(url) {
		// another LifePlanner (e.g. an older copy in a different folder) was
		// running; it has been asked to quit, so wait for the port to free up
		for i := 0; err != nil && i < 40; i++ {
			time.Sleep(250 * time.Millisecond)
			ln, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		}
	}
	if err != nil {
		// Already running (or port busy): if it's us, just open another tab.
		if resp, err2 := http.Get(url + "api/ping"); err2 == nil {
			resp.Body.Close()
			openBrowser(url)
			return
		}
		log.Fatalf("cannot listen on port %d: %v", port, err)
	}

	sub, _ := fs.Sub(webFS, "web")
	mux := http.NewServeMux()
	static := http.FileServer(http.FS(sub))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		static.ServeHTTP(w, r)
	}))
	mux.HandleFunc("/api/ping", handlePing)
	mux.HandleFunc("/api/data", handleData)
	mux.HandleFunc("/api/feed", handleFeed)
	mux.HandleFunc("/api/inbox", handleInbox)
	mux.HandleFunc("/api/inbox/dismissed", handleInboxDismissed)
	mux.HandleFunc("/api/portal", handlePortal)
	mux.HandleFunc("/api/browser/activities", handleBrowserActivities)
	mux.HandleFunc("/api/browser/health", handleBrowserHealth)
	mux.HandleFunc("/api/claudelink", handleClaudeLink)
	mux.HandleFunc("/api/account", handleAccount)
	mux.HandleFunc("/api/account/profile", handleAccountProfile)
	mux.HandleFunc("/api/account/people", handleAccountPeople)
	mux.HandleFunc("/api/update", handleUpdate)
	mux.HandleFunc("/api/update/check", handleUpdateCheck)
	mux.HandleFunc("/api/shortcuts", handleShortcuts)
	mux.HandleFunc("/api/strava", handleStrava)
	mux.HandleFunc("/api/strava/activities", handleStravaActivities)
	mux.HandleFunc("/strava/connect", handleStravaConnect)
	mux.HandleFunc("/api/intervals", handleIntervals)
	mux.HandleFunc("/api/intervals/activities", handleIntervalsActivities)
	mux.HandleFunc("/api/intervals/wellness", handleIntervalsWellness)
	mux.HandleFunc("/api/downloads/activities", handleDownloadsActivities)
	mux.HandleFunc("/strava/callback", handleStravaCallback)
	mux.HandleFunc("/api/brainfm", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		custom := strings.TrimSpace(r.URL.Query().Get("path"))
		if custom != "" && !strings.EqualFold(filepath.Ext(custom), ".exe") && !strings.EqualFold(filepath.Ext(custom), ".lnk") {
			custom = ""
		}
		target := findBrainfm(custom)
		if r.Method == http.MethodPost {
			if target == "" {
				http.Error(w, `{"ok":false}`, http.StatusNotFound)
				return
			}
			if err := launchApp(target); err != nil {
				http.Error(w, `{"ok":false}`, http.StatusInternalServerError)
				return
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "found": target})
	})
	mux.HandleFunc("/api/claude", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Query().Get("path")
		if r.Method != http.MethodPost || !strings.HasPrefix(path, "/") || strings.ContainsAny(path, "\"&|<>^% ") {
			http.Error(w, `{"ok":false}`, http.StatusBadRequest)
			return
		}
		if !openClaude(path) {
			http.Error(w, `{"ok":false}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})
	mux.HandleFunc("/api/seed", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(seedJSON)
	})
	mux.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"dataDir": dataDir, "version": version, "boot": bootID})
	})
	mux.HandleFunc("/api/quit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		go func() { time.Sleep(300 * time.Millisecond); os.Exit(0) }()
	})

	go watchIdle()
	go cleanupOld()
	go watchGitHub()
	if !restarted {
		go func() { time.Sleep(200 * time.Millisecond); openBrowser(url) }()
	}
	log.Printf("Life Planner running at %s, data in %s", url, dataDir)
	log.Fatal(http.Serve(ln, localOnly(mux)))
}

// localOnly rejects requests whose Host isn't our loopback address, which
// blocks DNS-rebinding attacks from websites open in the same browser.
func localOnly(h http.Handler) http.Handler {
	ok := map[string]bool{
		fmt.Sprintf("127.0.0.1:%d", port): true,
		fmt.Sprintf("localhost:%d", port): true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ok[r.Host] {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		// block cross-site form posts from other web pages
		// (web pages can't fake a chrome-extension:// origin, so the
		// Life Planner Connector extension may post its own endpoints)
		ext := (r.URL.Path == "/api/portal" || strings.HasPrefix(r.URL.Path, "/api/browser/")) && strings.HasPrefix(r.Header.Get("Origin"), "chrome-extension://")
		if o := r.Header.Get("Origin"); r.Method != http.MethodGet && o != "" && !ext && !ok[strings.TrimPrefix(o, "http://")] {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func handlePing(w http.ResponseWriter, r *http.Request) {
	pingMu.Lock()
	lastPing = time.Now()
	pingMu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"ok":true,"app":"life-planner"}`))
}

func watchIdle() {
	for range time.Tick(15 * time.Second) {
		pingMu.Lock()
		idle := time.Since(lastPing)
		pingMu.Unlock()
		if idle > idleTimeout {
			log.Printf("no open planner tab for %s, exiting", idle.Round(time.Second))
			os.Exit(0)
		}
	}
}

func handleData(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(dataDir, dataFileName)
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		b, err := os.ReadFile(path)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if os.IsNotExist(err) {
			w.Write([]byte("null"))
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Write(b)
	case http.MethodPut:
		// a tab left open from an older copy or before a restart must not
		// overwrite the data with what it has in memory
		if r.Header.Get("X-Planner-Boot") != bootID {
			http.Error(w, "stale page, reload", http.StatusConflict)
			return
		}
		if r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "expected application/json", http.StatusUnsupportedMediaType)
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 50<<20))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if !json.Valid(b) {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if err := saveAtomic(path, b); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		dailyBackup(b)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func saveAtomic(path string, b []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// dailyBackup keeps one snapshot per day for the last 14 days in data/backups.
func dailyBackup(b []byte) {
	dir := filepath.Join(dataDir, "backups")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}
	name := filepath.Join(dir, "planner-"+time.Now().Format("2006-01-02")+".json")
	if _, err := os.Stat(name); err == nil {
		return
	}
	os.WriteFile(name, b, 0o644)
	entries, _ := os.ReadDir(dir)
	for i := 0; i < len(entries)-14; i++ {
		os.Remove(filepath.Join(dir, entries[i].Name()))
	}
}

func openBrowser(url string) {
	if openAppWindow(url) {
		return
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("open browser: %v", err)
	}
}

var feedClient = &http.Client{Timeout: 20 * time.Second}

// handleFeed fetches a calendar (.ics) feed such as Google Calendar's
// "secret address in iCal format" on behalf of the page, which can't fetch
// other sites itself because of browser CORS rules.
func handleFeed(w http.ResponseWriter, r *http.Request) {
	u := strings.TrimSpace(r.URL.Query().Get("url"))
	if strings.HasPrefix(strings.ToLower(u), "webcal://") {
		u = "https://" + u[len("webcal://"):]
	}
	if !strings.HasPrefix(strings.ToLower(u), "https://") && !strings.HasPrefix(strings.ToLower(u), "http://") {
		http.Error(w, "calendar link must start with https://", http.StatusBadRequest)
		return
	}
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Header.Set("User-Agent", "LifePlanner/1.0")
	resp, err := feedClient.Do(req)
	if err != nil {
		http.Error(w, "could not reach calendar: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "calendar returned "+resp.Status, http.StatusBadGateway)
		return
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if !strings.Contains(string(b[:min(len(b), 4096)]), "BEGIN:VCALENDAR") {
		http.Error(w, "that link didn't return a calendar (.ics) file", http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Write(b)
}

// handleInbox serves data/missed-info.json, an email summary that Claude (or
// anything else) drops into the data folder, plus what the browser
// extension sent from the school portal.
func handleInbox(w http.ResponseWriter, r *http.Request) {
	b, err := os.ReadFile(filepath.Join(dataDir, "missed-info.json"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err != nil || !json.Valid(b) {
		b = nil
	}
	if b = withPortal(b); b == nil {
		w.Write([]byte("null"))
		return
	}
	w.Write(b)
}

// handleInboxDismissed saves the emails the user crossed off to
// data/missed-dismissed.json ({updated, ids, subjects}), which the hourly email
// check reads so it never brings them back or mentions them again.
func handleInboxDismissed(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		Updated  string   `json:"updated"`
		IDs      []string `json:"ids"`
		Subjects []string `json:"subjects"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&in); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	b, _ := json.MarshalIndent(in, "", "  ")
	os.MkdirAll(dataDir, 0o755)
	if err := os.WriteFile(filepath.Join(dataDir, "missed-dismissed.json"), b, 0o644); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// takeOverOtherCopy asks a LifePlanner already running on our port to quit if
// it is a different copy (another folder or another version), so the copy the
// user just opened is the one they see. It reports whether it asked.
func takeOverOtherCopy(url string) bool {
	c := &http.Client{Timeout: 2 * time.Second}
	req, _ := http.NewRequest(http.MethodGet, url+"api/info", nil)
	req.Host = fmt.Sprintf("127.0.0.1:%d", port)
	var info struct{ DataDir, Version string }
	if resp, err := c.Do(req); err == nil {
		json.NewDecoder(resp.Body).Decode(&info)
		resp.Body.Close()
	}
	if strings.EqualFold(filepath.Clean(info.DataDir), filepath.Clean(dataDir)) && info.Version == version {
		return false // same copy: just open another tab
	}
	req, _ = http.NewRequest(http.MethodPost, url+"api/quit", nil)
	req.Host = fmt.Sprintf("127.0.0.1:%d", port)
	resp, err := c.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	log.Printf("asked the other copy (%s, version %q) to quit", info.DataDir, info.Version)
	return true
}

func handleShortcuts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var req struct {
			Where string `json:"where"`
			On    bool   `json:"on"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := setShortcut(req.Where, req.On); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shortcutStatus())
}
