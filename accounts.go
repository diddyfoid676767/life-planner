package main

// Friend accounts: a username and password on the shared Supabase project, so
// friends can find each other by username and see each other's leaderboard
// stats and avatar. Supabase Auth stores the password; the app only keeps the
// session tokens, in data/account.json (0600), and never hands them to the
// page. Nothing personal is shared: just username, display name, avatar and
// the leaderboard numbers.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var (
	supaURL = "https://vtjvneusumjvhdctvijz.supabase.co"
	supaKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0anZuZXVzdW1qdmhkY3R2aWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTYwODcsImV4cCI6MjEwODI5MjA4N30.TzQqwPjHrB4NAAYzciQYP75zE8JTPAZOXcV-pHJuMDc" // public anon key; row-level security limits each user to their own profile
)

// LP_SUPA_URL and LP_SUPA_KEY point the app at another server, for testing.
func init() {
	if u, k := os.Getenv("LP_SUPA_URL"), os.Getenv("LP_SUPA_KEY"); u != "" && k != "" {
		supaURL, supaKey = u, k
	}
}

const (
	// Supabase Auth wants an email address; usernames get a made-up one that
	// is never written to (email confirmation is off).
	supaMailDomain = "users.lifeplanner.app"
)

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

type account struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Access   string `json:"access_token"`
	Refresh  string `json:"refresh_token"`
	Expires  int64  `json:"expires_at"`
}

func accountPath() string { return filepath.Join(dataDir, "account.json") }

func loadAccount() *account {
	b, err := os.ReadFile(accountPath())
	if err != nil {
		return nil
	}
	var a account
	if json.Unmarshal(b, &a) != nil || a.Refresh == "" {
		return nil
	}
	return &a
}

func saveAccount(a *account) error {
	b, _ := json.Marshal(a)
	return os.WriteFile(accountPath(), b, 0o600)
}

// supa calls the Supabase REST or Auth API. token "" uses the public key.
func supa(method, path, token string, body any, out any, extra ...string) (int, error) {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, supaURL+path, rd)
	req.Header.Set("apikey", supaKey)
	if token == "" {
		token = supaKey
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	for i := 0; i+1 < len(extra); i += 2 {
		req.Header.Set(extra[i], extra[i+1])
	}
	res, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return 0, fmt.Errorf("Couldn't reach the friends server. Check your internet connection.")
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode >= 300 {
		var e struct {
			Msg     string `json:"msg"`
			Message string `json:"message"`
			Error   string `json:"error_description"`
			Code    string `json:"code"`
		}
		json.Unmarshal(b, &e)
		msg := e.Msg + e.Message + e.Error
		if msg == "" {
			msg = res.Status
		}
		return res.StatusCode, fmt.Errorf("%s", msg)
	}
	if out != nil && len(b) > 0 {
		json.Unmarshal(b, out)
	}
	return res.StatusCode, nil
}

type authResp struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
	Expires int64  `json:"expires_at"`
	In      int64  `json:"expires_in"`
	User    struct {
		ID string `json:"id"`
	} `json:"user"`
}

func (r authResp) account(username string) *account {
	exp := r.Expires
	if exp == 0 {
		exp = time.Now().Unix() + r.In
	}
	return &account{UserID: r.User.ID, Username: username, Access: r.Access, Refresh: r.Refresh, Expires: exp}
}

// session returns the saved account with a fresh access token.
func session() (*account, error) {
	a := loadAccount()
	if a == nil {
		return nil, fmt.Errorf("not logged in")
	}
	if time.Now().Unix() < a.Expires-60 {
		return a, nil
	}
	var r authResp
	if code, err := supa("POST", "/auth/v1/token?grant_type=refresh_token", "", map[string]string{"refresh_token": a.Refresh}, &r); err != nil {
		if code == 400 || code == 401 {
			os.Remove(accountPath())
			return nil, fmt.Errorf("You were logged out. Please log in again.")
		}
		return nil, err
	}
	n := r.account(a.Username)
	if n.UserID == "" {
		n.UserID = a.UserID
	}
	return n, saveAccount(n)
}

func handleAccount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if supaKey == "" {
		json.NewEncoder(w).Encode(map[string]any{"configured": false})
		return
	}
	switch r.Method {
	case http.MethodGet:
		a := loadAccount()
		resp := map[string]any{"configured": true, "signedIn": a != nil, "rt": realtimeConfig()}
		if a != nil {
			resp["username"] = a.Username
		}
		json.NewEncoder(w).Encode(resp)
	case http.MethodPost:
		var in struct {
			Action   string `json:"action"`
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in) != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		user := strings.ToLower(strings.TrimSpace(in.Username))
		switch in.Action {
		case "signup", "login":
			if !usernameRe.MatchString(user) {
				writeErr(w, http.StatusBadRequest, "Usernames are 3 to 20 letters, numbers or _.")
				return
			}
			if len(in.Password) < 8 || len(in.Password) > 72 {
				writeErr(w, http.StatusBadRequest, "Passwords need at least 8 characters.")
				return
			}
			creds := map[string]string{"email": user + "@" + supaMailDomain, "password": in.Password}
			var ar authResp
			if in.Action == "signup" {
				var taken []map[string]any
				supa("GET", "/rest/v1/profiles?select=username&username=eq."+url.QueryEscape(user), "", nil, &taken)
				if len(taken) > 0 {
					writeErr(w, http.StatusConflict, "That username is taken. Try another one.")
					return
				}
				if _, err := supa("POST", "/auth/v1/signup", "", creds, &ar); err != nil {
					if strings.Contains(strings.ToLower(err.Error()), "already registered") {
						err = fmt.Errorf("That username is taken. Try another one.")
					}
					writeErr(w, http.StatusBadGateway, err.Error())
					return
				}
				if ar.Access == "" {
					writeErr(w, http.StatusBadGateway, "Sign-up needs \"Confirm email\" turned off in Supabase.")
					return
				}
				if _, err := supa("POST", "/rest/v1/profiles", ar.Access, map[string]any{"id": ar.User.ID, "username": user}, nil, "Prefer", "return=minimal"); err != nil {
					writeErr(w, http.StatusBadGateway, "Couldn't save your profile: "+err.Error())
					return
				}
			} else if code, err := supa("POST", "/auth/v1/token?grant_type=password", "", creds, &ar); err != nil {
				if code == 400 {
					err = fmt.Errorf("Wrong username or password.")
				}
				writeErr(w, http.StatusUnauthorized, err.Error())
				return
			}
			if err := saveAccount(ar.account(user)); err != nil {
				writeErr(w, http.StatusInternalServerError, "Couldn't save your login.")
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "username": user})
		case "logout":
			if a := loadAccount(); a != nil {
				supa("POST", "/auth/v1/logout", a.Access, nil, nil)
			}
			os.Remove(accountPath())
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "delete":
			a, err := session()
			if err != nil {
				writeErr(w, http.StatusUnauthorized, err.Error())
				return
			}
			if _, err := supa("DELETE", "/rest/v1/profiles?id=eq."+url.QueryEscape(a.UserID), a.Access, nil, nil); err != nil {
				writeErr(w, http.StatusBadGateway, err.Error())
				return
			}
			os.Remove(accountPath())
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			writeErr(w, http.StatusBadRequest, "unknown action")
		}
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

// PUT /api/account/profile {display, avatar, stats}: publish your board row.
func handleAccountProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut || supaKey == "" {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		Display string          `json:"display"`
		Avatar  json.RawMessage `json:"avatar"`
		Stats   json.RawMessage `json:"stats"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 24<<10)).Decode(&in) != nil || len(in.Avatar) > 5500 || len(in.Stats) > 14000 {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	a, err := session()
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	body := map[string]any{"display": cut(in.Display, 30), "avatar": in.Avatar, "stats": in.Stats, "updated_at": time.Now().UTC().Format(time.RFC3339)}
	if _, err := supa("PATCH", "/rest/v1/profiles?id=eq."+url.QueryEscape(a.UserID), a.Access, body, nil, "Prefer", "return=minimal"); err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Write([]byte(`{"ok":true}`))
}

// GET /api/account/people?q=prefix (search) or ?u=a,b,c (friends' rows).
func handleAccountPeople(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if supaKey == "" {
		w.Write([]byte("[]"))
		return
	}
	sel := "select=username,display,avatar,stats,updated_at,badges,jersey"
	var path string
	if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
		if !regexp.MustCompile(`^[a-z0-9_]{1,20}$`).MatchString(q) {
			w.Write([]byte("[]"))
			return
		}
		path = "/rest/v1/profiles?" + sel + "&username=like." + url.QueryEscape(q+"*") + "&order=username&limit=10"
	} else {
		var names []string
		for _, u := range strings.Split(r.URL.Query().Get("u"), ",") {
			if u = strings.ToLower(strings.TrimSpace(u)); usernameRe.MatchString(u) {
				names = append(names, u)
			}
		}
		if len(names) == 0 || len(names) > 100 {
			w.Write([]byte("[]"))
			return
		}
		path = "/rest/v1/profiles?" + sel + "&username=in.(" + url.QueryEscape(strings.Join(names, ",")) + ")"
	}
	var out []map[string]any
	if code, err := supa("GET", path, "", nil, &out); err != nil {
		// badges and jersey numbers need the 2.22.7 database update
		if code != 400 {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		if _, err := supa("GET", strings.Replace(path, ",badges,jersey", "", 1), "", nil, &out); err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
	}
	if out == nil {
		out = []map[string]any{}
	}
	json.NewEncoder(w).Encode(out)
}

// realtimeConfig is what the page needs for live PvP battles: the Supabase
// Realtime socket and the public anon key (the same key every copy of the app
// ships with). Battles use broadcast channels only, so nothing is stored.
// LP_REALTIME_WS points it at another server, for testing.
func realtimeConfig() map[string]string {
	ws := os.Getenv("LP_REALTIME_WS")
	if ws == "" {
		ws = strings.Replace(supaURL, "https://", "wss://", 1) + "/realtime/v1/websocket"
	}
	return map[string]string{"ws": ws, "key": supaKey}
}
