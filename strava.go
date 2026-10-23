package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Strava: each person makes their own (free) Strava API app and pastes its
// Client ID and Secret into Settings. The planner then does the usual OAuth
// sign-in with 127.0.0.1 as the callback, keeps the tokens in data/strava.json
// and hands the page a slim list of recent activities. The secret and tokens
// never go back to the page.

type stravaConf struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Access       string `json:"access,omitempty"`
	Refresh      string `json:"refresh,omitempty"`
	Expires      int64  `json:"expires,omitempty"`
	Athlete      string `json:"athlete,omitempty"`
	State        string `json:"state,omitempty"`
}

var stravaMu sync.Mutex

func stravaPath() string { return filepath.Join(dataDir, "strava.json") }

func loadStrava() stravaConf {
	var c stravaConf
	if b, err := os.ReadFile(stravaPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	return c
}

func saveStrava(c stravaConf) error {
	b, _ := json.MarshalIndent(c, "", "  ")
	os.MkdirAll(dataDir, 0o755)
	return os.WriteFile(stravaPath(), b, 0o600)
}

var stravaRedirect = fmt.Sprintf("http://127.0.0.1:%d/strava/callback", port)

func stravaToken(form url.Values) (map[string]any, error) {
	resp, err := (&http.Client{Timeout: 20 * time.Second}).PostForm("https://www.strava.com/oauth/token", form)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out map[string]any
	json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out)
	if resp.StatusCode != 200 {
		msg, _ := out["message"].(string)
		return nil, fmt.Errorf("Strava said: %s (%d)", msg, resp.StatusCode)
	}
	return out, nil
}

func applyTokens(c *stravaConf, t map[string]any) {
	c.Access, _ = t["access_token"].(string)
	if r, ok := t["refresh_token"].(string); ok && r != "" {
		c.Refresh = r
	}
	if e, ok := t["expires_at"].(float64); ok {
		c.Expires = int64(e)
	}
	if a, ok := t["athlete"].(map[string]any); ok {
		fn, _ := a["firstname"].(string)
		ln, _ := a["lastname"].(string)
		c.Athlete = strings.TrimSpace(fn + " " + ln)
	}
}

// a valid access token, refreshing it when it is about to run out
func stravaAccess() (string, error) {
	stravaMu.Lock()
	defer stravaMu.Unlock()
	c := loadStrava()
	if c.Refresh == "" {
		return "", fmt.Errorf("not connected")
	}
	if c.Access != "" && time.Now().Unix() < c.Expires-120 {
		return c.Access, nil
	}
	t, err := stravaToken(url.Values{"client_id": {c.ClientID}, "client_secret": {c.ClientSecret}, "grant_type": {"refresh_token"}, "refresh_token": {c.Refresh}})
	if err != nil {
		return "", err
	}
	applyTokens(&c, t)
	saveStrava(c)
	return c.Access, nil
}

func handleStrava(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		c := loadStrava()
		json.NewEncoder(w).Encode(map[string]any{"configured": c.ClientID != "" && c.ClientSecret != "", "connected": c.Refresh != "", "athlete": c.Athlete, "clientId": c.ClientID})
	case http.MethodPut:
		var in struct{ ClientID, ClientSecret string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		id, sec := strings.TrimSpace(in.ClientID), strings.TrimSpace(in.ClientSecret)
		if _, err := strconv.Atoi(id); err != nil || len(sec) < 20 {
			writeErr(w, http.StatusBadRequest, "That doesn't look like a Strava Client ID (a number) and Client Secret (a long code).")
			return
		}
		stravaMu.Lock()
		err := saveStrava(stravaConf{ClientID: id, ClientSecret: sec})
		stravaMu.Unlock()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	case http.MethodDelete:
		stravaMu.Lock()
		os.Remove(stravaPath())
		stravaMu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

// /strava/connect sends the browser to Strava's sign-in page
func handleStravaConnect(w http.ResponseWriter, r *http.Request) {
	stravaMu.Lock()
	c := loadStrava()
	c.State = strconv.FormatInt(time.Now().UnixNano(), 36)
	saveStrava(c)
	stravaMu.Unlock()
	if c.ClientID == "" {
		http.Redirect(w, r, "/#strava=missing", http.StatusFound)
		return
	}
	q := url.Values{"client_id": {c.ClientID}, "response_type": {"code"}, "redirect_uri": {stravaRedirect}, "approval_prompt": {"auto"}, "scope": {"read,activity:read_all"}, "state": {c.State}}
	http.Redirect(w, r, "https://www.strava.com/oauth/authorize?"+q.Encode(), http.StatusFound)
}

func handleStravaCallback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	stravaMu.Lock()
	defer stravaMu.Unlock()
	c := loadStrava()
	if q.Get("error") != "" || q.Get("code") == "" || c.State == "" || q.Get("state") != c.State {
		http.Redirect(w, r, "/#strava=denied", http.StatusFound)
		return
	}
	if !strings.Contains(q.Get("scope"), "activity:read") {
		http.Redirect(w, r, "/#strava=scope", http.StatusFound)
		return
	}
	t, err := stravaToken(url.Values{"client_id": {c.ClientID}, "client_secret": {c.ClientSecret}, "code": {q.Get("code")}, "grant_type": {"authorization_code"}})
	if err != nil {
		http.Redirect(w, r, "/#strava=error", http.StatusFound)
		return
	}
	applyTokens(&c, t)
	c.State = ""
	saveStrava(c)
	http.Redirect(w, r, "/#strava=connected", http.StatusFound)
}

type stravaActivity struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	SportType string  `json:"sport_type"`
	Start     string  `json:"start_date_local"`
	Moving    int     `json:"moving_time"`
	Elapsed   int     `json:"elapsed_time"`
	Distance  float64 `json:"distance"`
	AvgHR     float64 `json:"average_heartrate"`
	Suffer    float64 `json:"suffer_score"`
	Elev      float64 `json:"total_elevation_gain"`
}

// /api/strava/activities?after=<unix seconds>
func handleStravaActivities(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	tok, err := stravaAccess()
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	var all []stravaActivity
	cl := &http.Client{Timeout: 25 * time.Second}
	for page := 1; page <= 6; page++ {
		req, _ := http.NewRequest("GET", fmt.Sprintf("https://www.strava.com/api/v3/athlete/activities?after=%d&per_page=100&page=%d", after, page), nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		resp, err := cl.Do(req)
		if err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		var list []stravaActivity
		if resp.StatusCode != 200 {
			resp.Body.Close()
			writeErr(w, http.StatusBadGateway, fmt.Sprintf("Strava returned %d", resp.StatusCode))
			return
		}
		json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&list)
		resp.Body.Close()
		all = append(all, list...)
		if len(list) < 100 {
			break
		}
	}
	json.NewEncoder(w).Encode(map[string]any{"items": all})
}
