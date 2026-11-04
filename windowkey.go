package main

// The planner's page and its data are only served to the app's own window:
// the window opens with a key (?k=...), which becomes a cookie. Opening
// 127.0.0.1 in an ordinary browser gets a "use the app" page instead, so the
// browser's developer console can't be used to change coins and the like.
// (The planner file itself can still be edited by hand; what friends see is
// checked by the friends server's rules.)

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func windowKeyPath() string { return filepath.Join(dataDir, "window.key") }

func readWindowKey() string {
	b, _ := os.ReadFile(windowKeyPath())
	return strings.TrimSpace(string(b))
}

// newWindowKey returns the key, making one the first time. It stays the same
// across restarts, so a window left open over an update keeps working.
func newWindowKey() string {
	if k := readWindowKey(); len(k) == 32 {
		return k
	}
	b := make([]byte, 16)
	rand.Read(b)
	k := hex.EncodeToString(b)
	os.WriteFile(windowKeyPath(), []byte(k), 0o600)
	return k
}

const keyCookie = "lp_k"

func windowAllowed(w http.ResponseWriter, r *http.Request, key string) bool {
	same := func(s string) bool { return subtle.ConstantTimeCompare([]byte(s), []byte(key)) == 1 }
	if q := r.URL.Query().Get("k"); q != "" && same(q) {
		http.SetCookie(w, &http.Cookie{Name: keyCookie, Value: key, Path: "/", MaxAge: 365 * 24 * 3600, HttpOnly: true, SameSite: http.SameSiteStrictMode})
		if r.URL.Path == "/" && r.Method == http.MethodGet { // drop the key from the address
			http.Redirect(w, r, "/", http.StatusFound)
			return false
		}
		return true
	}
	if c, err := r.Cookie(keyCookie); err == nil && same(c.Value) {
		return true
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.Error(w, `{"error":"Open Solis from its icon."}`, http.StatusForbidden)
		return false
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusForbidden)
	w.Write([]byte(`<!doctype html><meta charset="utf-8"><title>Solis</title><body style="font:16px system-ui;padding:40px;text-align:center"><h2>Solis runs in its own window</h2><p>Close this tab and open Solis from its icon.</p></body>`))
	return false
}
