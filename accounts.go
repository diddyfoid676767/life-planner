package main

// Friend accounts: a username and password on the shared Firebase project
// (firebase.go), so friends can find each other by username and see each
// other's leaderboard stats and avatar. Firebase Auth stores the password; the app only keeps the
// session tokens, in data/account.json (0600), and never hands them to the
// page. Nothing personal is shared: just username, display name, avatar and
// the leaderboard numbers.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
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
	Backend  string `json:"backend"` // "fb" once moved to Firebase; older logins were on Supabase
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

// devName is the developer's username: the Dev badge and everyone's feedback
// chat go to them. It must match devName() in firestore.rules.
const devName = "foidkilla67"

// session returns the saved account with a fresh ID token. A login from
// before the move to Firebase has to log in once more, which brings the
// account over (see migrate).
func session() (*account, error) {
	a := loadAccount()
	if a == nil {
		return nil, fmt.Errorf("not logged in")
	}
	if a.Backend != "fb" {
		return nil, fmt.Errorf("Solis moved to a new friends server. Log in once more to bring your account over.")
	}
	if time.Now().Unix() < a.Expires-60 {
		return a, nil
	}
	n, err := fbRefresh(a)
	if err != nil {
		if e, ok := err.(*fbErr); ok && e.Code >= 400 && e.Code < 500 {
			os.Remove(accountPath())
			return nil, fmt.Errorf("You were logged out. Please log in again.")
		}
		return nil, err
	}
	if n.UserID == "" {
		n.UserID = a.UserID
	}
	return n, saveAccount(n)
}

func handleAccount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if !fbOn() {
		json.NewEncoder(w).Encode(map[string]any{"configured": false})
		return
	}
	switch r.Method {
	case http.MethodGet:
		a := loadAccount()
		if a != nil && a.Backend != "fb" {
			a = nil // signed in on the old server: show the log in form, which moves the account
		}
		resp := map[string]any{"configured": true, "signedIn": a != nil, "rt": realtimeConfig()}
		if a != nil {
			resp["username"] = a.Username
			resp["sync"] = syncInfo()
		} else if old := loadAccount(); old != nil {
			resp["moved"] = old.Username
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
			var a *account
			var err error
			code := http.StatusBadGateway
			if in.Action == "signup" {
				a, err = signUp(user, in.Password)
			} else {
				a, code, err = logIn(user, in.Password)
			}
			if err != nil {
				writeErr(w, code, err.Error())
				return
			}
			if err := saveAccount(a); err != nil {
				writeErr(w, http.StatusInternalServerError, "Couldn't save your login.")
				return
			}
			go cloudSync(false)
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "username": user})
		case "logout":
			os.Remove(accountPath())
			forgetSync()
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "delete":
			a, err := session()
			if err != nil {
				writeErr(w, http.StatusUnauthorized, err.Error())
				return
			}
			ws := []fsWrite{fsDel("planner/" + a.UserID), fsDel("profiles/" + a.UserID), fsDel("usernames/" + a.Username)}
			if p, _ := fsGet(a.Access, "profiles/"+a.UserID, "jersey"); p != nil && p.Fields["jersey"] != nil {
				ws = append(ws, fsDel(fmt.Sprintf("jerseys/%d", int(num(p.Fields["jersey"])))))
			}
			if _, err := fsCommit(a.Access, ws...); err != nil {
				writeErr(w, http.StatusBadGateway, err.Error())
				return
			}
			fbDeleteUser(a)
			os.Remove(accountPath())
			forgetSync()
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			writeErr(w, http.StatusBadRequest, "unknown action")
		}
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

func signUp(user, pw string) (*account, error) {
	email := user + "@" + supaMailDomain
	if d, _ := fsGet("", "usernames/"+user); d != nil {
		return nil, fmt.Errorf("That username is taken. Try another one.")
	}
	// someone on the old server who hasn't moved over yet keeps their name
	var taken []map[string]any
	supa("GET", "/rest/v1/profiles?select=username&username=eq."+url.QueryEscape(user), "", nil, &taken)
	if len(taken) > 0 {
		return nil, fmt.Errorf("That username is taken. Try another one.")
	}
	ar, err := fbSignUp(email, pw)
	if err != nil {
		if fbStatus(err) == "EMAIL_EXISTS" {
			err = fmt.Errorf("That username is taken. Try another one.")
		}
		return nil, err
	}
	a := ar.account(user)
	if err := createProfile(a, map[string]any{}, nil); err != nil {
		return nil, fmt.Errorf("Couldn't save your profile: %v", err)
	}
	return a, nil
}

// logIn signs in on Firebase. Someone who isn't there yet but is on the old
// Supabase server with the same password is moved over (migrate).
func logIn(user, pw string) (*account, int, error) {
	email := user + "@" + supaMailDomain
	ar, err := fbSignIn(email, pw)
	if err == nil {
		a := ar.account(user)
		if p, _ := fsGet(a.Access, "profiles/"+a.UserID, "username"); p == nil {
			createProfile(a, map[string]any{}, nil) // the profile didn't get saved at sign up
		}
		return a, 0, nil
	}
	st := fbStatus(err)
	if st != "INVALID_LOGIN_CREDENTIALS" && st != "EMAIL_NOT_FOUND" && st != "INVALID_PASSWORD" {
		return nil, http.StatusBadGateway, err
	}
	a, err := migrate(user, pw)
	if err != nil {
		return nil, http.StatusUnauthorized, err
	}
	return a, 0, nil
}

type authResp struct {
	Access string `json:"access_token"`
	User   struct {
		ID string `json:"id"`
	} `json:"user"`
}

// migrate moves an account from the old Supabase server: the same username
// and password, profile, badges, jersey number and synced planner.
func migrate(user, pw string) (*account, error) {
	wrong := fmt.Errorf("Wrong username or password.")
	email := user + "@" + supaMailDomain
	var sr authResp
	if code, err := supa("POST", "/auth/v1/token?grant_type=password", "", map[string]string{"email": email, "password": pw}, &sr); err != nil {
		if code == 400 || code == 0 { // wrong password, or not on the old server either
			return nil, wrong
		}
		return nil, err
	}
	ar, err := fbSignUp(email, pw)
	if err != nil {
		if fbStatus(err) == "EMAIL_EXISTS" {
			return nil, wrong
		}
		return nil, err
	}
	a := ar.account(user)
	var prof []struct {
		Display string          `json:"display"`
		Avatar  json.RawMessage `json:"avatar"`
		Stats   json.RawMessage `json:"stats"`
		Badges  []string        `json:"badges"`
		Jersey  *int            `json:"jersey"`
	}
	if _, err := supa("GET", "/rest/v1/profiles?select=display,avatar,stats,badges,jersey&id=eq."+url.QueryEscape(sr.User.ID), sr.Access, nil, &prof); err != nil {
		supa("GET", "/rest/v1/profiles?select=display,avatar,stats&id=eq."+url.QueryEscape(sr.User.ID), sr.Access, nil, &prof)
	}
	fields := map[string]any{}
	var badges []string
	var jersey *int
	if len(prof) > 0 {
		p := prof[0]
		fields["display"] = p.Display
		if len(p.Avatar) > 0 && string(p.Avatar) != "null" {
			fields["avatar"] = string(p.Avatar)
		}
		if s, _ := decodeJSON(p.Stats); s != nil {
			fields["stats"] = s
		}
		for _, b := range p.Badges {
			if b == "beta" {
				badges = append(badges, b)
			}
		}
		jersey = p.Jersey
	}
	if err := createProfile(a, fields, badges); err != nil {
		return nil, fmt.Errorf("Couldn't move your profile over: %v", err)
	}
	if jersey != nil {
		claimJersey(a, jersey)
	}
	var rows []cloudRow
	if _, err := supa("GET", "/rest/v1/planner_data?select=data,updated_at&user_id=eq."+url.QueryEscape(sr.User.ID), sr.Access, nil, &rows); err == nil && len(rows) > 0 && json.Valid(rows[0].Data) {
		fsCommit(a.Access, fsSet("planner/"+a.UserID, map[string]any{"data": string(rows[0].Data), "device": "moved"}, false, "new", "updated_at"))
	}
	return a, nil
}

// createProfile claims the username and saves the first profile row.
func createProfile(a *account, f map[string]any, badges []string) error {
	stats, _ := f["stats"].(map[string]any)
	if stats == nil {
		stats = map[string]any{}
	}
	if a.Username == devName {
		badges = append([]string{"dev"}, badges...)
	}
	if badges == nil {
		badges = []string{}
	}
	av, _ := f["avatar"].(string)
	if len(av) > 6000 {
		av = ""
	}
	disp, _ := f["display"].(string)
	p := map[string]any{"username": a.Username, "display": cut(disp, 30), "avatar": av, "stats": clampStats(nil, stats, 0, time.Now()),
		"badges": badges, "jersey": nil}
	_, err := fsCommit(a.Access,
		fsSet("usernames/"+a.Username, map[string]any{"uid": a.UserID}, false, "new"),
		fsSet("profiles/"+a.UserID, p, false, "new", "born", "updated_at"))
	return err
}

func claimJersey(a *account, n *int) error {
	ws := []fsWrite{}
	if p, _ := fsGet(a.Access, "profiles/"+a.UserID, "jersey"); p != nil && p.Fields["jersey"] != nil {
		old := int(num(p.Fields["jersey"]))
		if n != nil && old == *n {
			return nil
		}
		ws = append(ws, fsDel(fmt.Sprintf("jerseys/%d", old)))
	}
	var v any
	if n != nil {
		ws = append(ws, fsSet(fmt.Sprintf("jerseys/%d", *n), map[string]any{"uid": a.UserID}, false, "new"))
		v = *n
	}
	ws = append(ws, fsSet("profiles/"+a.UserID, map[string]any{"jersey": v}, true, "old"))
	_, err := fsCommit(a.Access, ws...)
	return err
}

// ---------- leaderboard numbers ----------

// statKeys are the stats a profile may hold (statsShape in firestore.rules).
var statKeys = map[string]bool{"week": true, "study": true, "work": true, "health": true, "chal": true, "now": true, "prev": true, "pvp": true, "fit": true, "fr": true, "st": true, "ss": true, "yr": true, "cw": true, "pw": true, "gr": true, "fo": true, "hs": true}

type statRule struct {
	a, b         string
	perMin, base float64 // how fast it may climb between saves (riseOk)
	max          float64 // lifetime cap (lifeOk)
}

var statRules = []statRule{
	{"study", "coins", 10, 300, 200000}, {"study", "trees", 0.2, 3, 10000}, {"study", "streak", 0.001, 1, 1000},
	{"work", "wins", 1, 3, 20000}, {"work", "surv", 1, 5, 10000}, {"work", "grit", 5, 50, 1000000}, {"work", "ovr", 0.1, 2, 200},
	{"pvp", "r", 10, 60, 5000}, {"pvp", "w", 0.5, 2, 20000}, {"pvp", "l", 0.5, 2, 20000},
}

func toF(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case json.Number:
		f, err := x.Float64()
		return f, err == nil
	case int:
		return float64(x), true
	}
	return 0, false
}

func sub(s map[string]any, a string) map[string]any {
	m, _ := s[a].(map[string]any)
	return m
}

func getStat(s map[string]any, a, b string) float64 {
	f, _ := toF(sub(s, a)[b])
	return f
}

func setStat(s map[string]any, a, b string, v float64) {
	m := sub(s, a)
	if m == nil {
		if v == 0 {
			return
		}
		m = map[string]any{}
		s[a] = m
	}
	m[b] = math.Floor(v)
}

// clampStats keeps a profile's numbers inside what firestore.rules accepts,
// so a save from an honest app always goes through: numbers that jumped
// (after an import, say) catch up over the next saves instead. old is the
// row on the server (nil for a new one), mins the minutes since it was saved.
func clampStats(old, s map[string]any, mins float64, now time.Time) map[string]any {
	out := map[string]any{}
	for k, v := range s {
		if statKeys[k] {
			out[k] = v
		}
	}
	cleanNewStats(out, old, math.Max(0, mins-2))
	for _, k := range []string{"study", "work", "pvp"} {
		if _, ok := out[k].(map[string]any); !ok {
			delete(out, k)
		} else { // copy, so the caller's map isn't changed
			m := map[string]any{}
			for kk, vv := range out[k].(map[string]any) {
				m[kk] = vv
			}
			out[k] = m
		}
	}
	if l, ok := out["fr"].([]any); ok && len(l) > 60 {
		out["fr"] = l[:60]
	} else if !ok {
		delete(out, "fr")
	}
	if l, ok := out["chal"].([]any); ok && len(l) > 12 {
		out["chal"] = l[:12]
	} else if !ok {
		delete(out, "chal")
	}
	for _, k := range [][2]string{{"study", "mins"}, {"work", "mins"}, {"study", "coins"}} {
		if v, ok := sub(out, k[0])[k[1]]; ok {
			if f, ok := toF(v); !ok || f < 0 {
				setStat(out, k[0], k[1], 0)
			}
		}
	}
	// this week's minutes can't be more than the minutes the week has had
	wk, _ := out["week"].(string)
	t, err := time.Parse("2006-01-02", wk)
	weekMins := now.Sub(t).Minutes() + 1440 - 60
	if err != nil || weekMins <= 60 || weekMins >= 9*1440-60 {
		delete(out, "week")
		setStat(out, "study", "mins", 0)
		setStat(out, "work", "mins", 0)
	} else {
		for _, a := range []string{"study", "work"} {
			setStat(out, a, "mins", math.Min(getStat(out, a, "mins"), weekMins))
		}
	}
	mins = math.Max(0, mins-2) // the server's clock decides; leave room
	if old != nil {
		if ow, _ := old["week"].(string); ow == wk && wk != "" {
			for _, a := range []string{"study", "work"} {
				setStat(out, a, "mins", math.Min(getStat(out, a, "mins"), getStat(old, a, "mins")+mins+5))
			}
		}
	}
	for _, r := range statRules {
		if _, ok := sub(out, r.a)[r.b]; !ok {
			continue
		}
		v, ok := toF(sub(out, r.a)[r.b])
		if !ok {
			delete(sub(out, r.a), r.b)
			continue
		}
		v = math.Min(v, r.max)
		if old != nil {
			v = math.Min(v, getStat(old, r.a, r.b)+mins*r.perMin+r.base)
		}
		setStat(out, r.a, r.b, v)
	}
	return out
}

// PUT /api/account/profile {display, avatar, stats}: publish your board row.
func handleAccountProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut || !fbOn() {
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
	stats := map[string]any{}
	if v, _ := decodeJSON(in.Stats); v != nil {
		stats, _ = v.(map[string]any)
	}
	av := ""
	if len(in.Avatar) > 0 && string(in.Avatar) != "null" {
		av = string(in.Avatar)
	}
	later, err := publishProfile(a, in.Display, av, stats, time.Now())
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "later": later})
}

// publishProfile saves your board row, with the numbers clamped to what the
// rules accept. later is true when the last save was too recent (the server
// takes one every 20 seconds).
func publishProfile(a *account, display, av string, stats map[string]any, now time.Time) (later bool, err error) {
	cur, err := fsGet(a.Access, "profiles/"+a.UserID)
	if err != nil {
		return false, err
	}
	if cur == nil {
		return false, createProfile(a, map[string]any{"display": display, "avatar": av, "stats": stats}, nil)
	}
	at, _ := time.Parse(time.RFC3339Nano, str(cur.Fields["updated_at"]))
	mins := now.Sub(at).Minutes()
	if mins < 21.0/60 {
		return true, nil
	}
	old, _ := cur.Fields["stats"].(map[string]any)
	body := map[string]any{"display": cut(display, 30), "avatar": av, "stats": clampStats(old, stats, mins, now)}
	_, err = fsCommit(a.Access, fsSet("profiles/"+a.UserID, body, true, cur.Updated, "updated_at"))
	// rules from before 2.44 don't know the house stats yet
	if fe, ok := err.(*fbErr); ok && fe.Status == "PERMISSION_DENIED" && body["stats"].(map[string]any)["hs"] != nil {
		delete(body["stats"].(map[string]any), "hs")
		_, err = fsCommit(a.Access, fsSet("profiles/"+a.UserID, body, true, cur.Updated, "updated_at"))
	}
	// rules from before 2.40 don't know the season, grade and forest stats yet
	if fe, ok := err.(*fbErr); ok && fe.Status == "PERMISSION_DENIED" && hasNewStats(body["stats"].(map[string]any)) {
		st := body["stats"].(map[string]any)
		for k := range newStatKeys {
			delete(st, k)
		}
		_, err = fsCommit(a.Access, fsSet("profiles/"+a.UserID, body, true, cur.Updated, "updated_at"))
	}
	return false, err
}

// newStatKeys are the stats added in 2.40: online/studying status (st), the
// term season (ss) and year (yr) boards, the weekly competition (cw, pw),
// grades shared by choice (gr) and a picture of the forest (fo).
var houseIDs = map[string]bool{"pascoe": true, "molland": true, "flinders": true, "derrimut": true, "strathmore": true, "hudson": true}

var newStatKeys = map[string]bool{"st": true, "ss": true, "yr": true, "cw": true, "pw": true, "gr": true, "fo": true}

func hasNewStats(s map[string]any) bool {
	for k := range newStatKeys {
		if _, ok := s[k]; ok {
			return true
		}
	}
	return false
}

// cleanNewStats keeps the 2.40 stats to the shapes firestore.rules accepts.
func cleanNewStats(out map[string]any, old map[string]any, mins float64) {
	num := func(m map[string]any, k string, max float64) {
		f, ok := toF(m[k])
		if !ok || f < 0 {
			delete(m, k)
			return
		}
		m[k] = math.Min(f, max)
	}
	only := func(k string, keys ...string) map[string]any {
		m, ok := out[k].(map[string]any)
		if !ok {
			delete(out, k)
			return nil
		}
		c := map[string]any{}
		for _, kk := range keys {
			if v, ok := m[kk]; ok {
				c[kk] = v
			}
		}
		out[k] = c
		return c
	}
	if m := only("st", "t", "s", "at", "p", "x"); m != nil {
		m["s"] = cut(str(m["s"]), 30)
		for _, k := range []string{"t", "at", "p", "x"} {
			num(m, k, 1e13)
		}
	}
	if m := only("ss", "id", "s", "k", "tr"); m != nil {
		m["id"] = cut(str(m["id"]), 10)
		num(m, "s", 200000)
		num(m, "k", 200000)
		num(m, "tr", 10000)
		if o, _ := old["ss"].(map[string]any); o != nil && str(o["id"]) == m["id"] {
			for _, k := range []string{"s", "k"} {
				if v, ok := m[k].(float64); ok {
					m[k] = math.Min(v, getStat(old, "ss", k)+mins+5)
				}
			}
		}
	}
	if m := only("yr", "y", "tr", "w"); m != nil {
		num(m, "y", 3000)
		num(m, "tr", 10000)
		num(m, "w", 20000)
	}
	for _, k := range []string{"cw", "pw"} {
		if m := only(k, "wk", "v"); m != nil {
			m["wk"] = cut(str(m["wk"]), 10)
			num(m, "v", 20000)
		}
	}
	if m := only("gr", "m", "r", "y", "o", "s"); m != nil {
		num(m, "m", 1)
		num(m, "r", 1)
		num(m, "y", 3000)
		num(m, "o", 100)
		m["s"] = cut(str(m["s"]), 480)
	}
	// 2.44 houses: house id, week, damage this week (d) and last week (p),
	// average of the three weeks before (a), effort points (e), card ratings (m, b)
	if m := only("hs", "h", "wk", "d", "p", "a", "e", "m", "b"); m != nil {
		if !houseIDs[str(m["h"])] {
			delete(out, "hs")
		} else {
			m["wk"] = cut(str(m["wk"]), 10)
			for _, k := range []string{"d", "p", "a", "e"} {
				num(m, k, 20000)
			}
			num(m, "m", 99)
			num(m, "b", 99)
		}
	}
	if m := only("fo", "n", "t"); m != nil {
		num(m, "n", 10000)
		m["t"] = cut(str(m["t"]), 1200)
	}
}

// profileRow is a profile as the page wants it.
func profileRow(d *fsDoc) map[string]any {
	f := d.Fields
	row := map[string]any{"username": f["username"], "display": f["display"], "stats": f["stats"], "updated_at": f["updated_at"], "badges": f["badges"], "jersey": f["jersey"]}
	if row["badges"] == nil {
		row["badges"] = []any{}
	}
	if av := str(f["avatar"]); av != "" && json.Valid([]byte(av)) {
		row["avatar"] = json.RawMessage(av)
	}
	return row
}

// GET /api/account/people?q=prefix (search) or ?u=a,b,c (friends' rows).
func handleAccountPeople(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if !fbOn() {
		w.Write([]byte("[]"))
		return
	}
	from := []map[string]string{{"collectionId": "profiles"}}
	var docs []*fsDoc
	var err error
	if wk := r.URL.Query().Get("houseweek"); wk != "" {
		// everyone in a house who has played this week, for the house bosses
		if !regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`).MatchString(wk) {
			w.Write([]byte("[]"))
			return
		}
		docs, err = fsQuery("", "", map[string]any{"from": from, "limit": 400, "where": fsWhere("stats.hs.wk", "EQUAL", wk)})
	} else if r.URL.Query().Get("suggest") != "" {
		// people who were on most recently, for "people you might know"
		docs, err = fsQuery("", "", map[string]any{"from": from, "limit": 24,
			"orderBy": []any{map[string]any{"field": map[string]string{"fieldPath": "updated_at"}, "direction": "DESCENDING"}}})
	} else if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
		if !regexp.MustCompile(`^[a-z0-9_]{1,20}$`).MatchString(q) {
			w.Write([]byte("[]"))
			return
		}
		docs, err = fsQuery("", "", map[string]any{"from": from, "limit": 10,
			"where":   fsAnd(fsWhere("username", "GREATER_THAN_OR_EQUAL", q), fsWhere("username", "LESS_THAN", q+"")),
			"orderBy": []any{map[string]any{"field": map[string]string{"fieldPath": "username"}}}})
	} else {
		var names []any
		for _, u := range strings.Split(r.URL.Query().Get("u"), ",") {
			if u = strings.ToLower(strings.TrimSpace(u)); usernameRe.MatchString(u) {
				names = append(names, u)
			}
		}
		if len(names) == 0 || len(names) > 100 {
			w.Write([]byte("[]"))
			return
		}
		for i := 0; i < len(names) && err == nil; i += 30 {
			var part []*fsDoc
			part, err = fsQuery("", "", map[string]any{"from": from, "where": fsWhere("username", "IN", names[i:min(i+30, len(names))])})
			docs = append(docs, part...)
		}
	}
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	out := []map[string]any{}
	for _, d := range docs {
		if r.URL.Query().Get("houseweek") != "" { // just what the house page needs
			st, _ := d.Fields["stats"].(map[string]any)
			out = append(out, map[string]any{"username": d.Fields["username"], "display": d.Fields["display"], "hs": st["hs"], "updated_at": d.Fields["updated_at"]})
			continue
		}
		out = append(out, profileRow(d))
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
