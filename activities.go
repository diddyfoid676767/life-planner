package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Automatic activity import without a Strava subscription:
//   - intervals.icu (free) syncs with Garmin Connect; the planner reads it with
//     the athlete's own API key, kept in data/intervals.json and never sent to the page.
//   - an activity CSV saved to the Downloads folder (Garmin "Export CSV" or a
//     Strava export's activities.csv) is picked up by itself.

type intervalsConf struct {
	Athlete string `json:"athlete"`
	Key     string `json:"key"`
}

var intervalsMu sync.Mutex

func intervalsPath() string { return filepath.Join(dataDir, "intervals.json") }

func loadIntervals() intervalsConf {
	var c intervalsConf
	if b, err := os.ReadFile(intervalsPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	return c
}

var athleteRe = regexp.MustCompile(`^i?\d{1,12}$`)

func handleIntervals(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	intervalsMu.Lock()
	defer intervalsMu.Unlock()
	switch r.Method {
	case http.MethodGet:
		c := loadIntervals()
		json.NewEncoder(w).Encode(map[string]any{"connected": c.Key != "", "athlete": c.Athlete})
	case http.MethodPut:
		var in struct{ Athlete, Key string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		a, k := strings.TrimSpace(in.Athlete), strings.TrimSpace(in.Key)
		if !athleteRe.MatchString(a) || len(k) < 10 || len(k) > 200 {
			writeErr(w, http.StatusBadRequest, "That doesn't look right. The Athlete ID looks like i123456 and the API key is a long code.")
			return
		}
		if !strings.HasPrefix(a, "i") {
			a = "i" + a
		}
		c := intervalsConf{Athlete: a, Key: k}
		if _, err := intervalsFetch(c, time.Now().AddDate(0, 0, -2).Format("2006-01-02")); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		b, _ := json.MarshalIndent(c, "", "  ")
		os.MkdirAll(dataDir, 0o755)
		if err := os.WriteFile(intervalsPath(), b, 0o600); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	case http.MethodDelete:
		os.Remove(intervalsPath())
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

type icuActivity struct {
	ID       any     `json:"id"`
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Start    string  `json:"start_date_local"`
	Moving   float64 `json:"moving_time"`
	Elapsed  float64 `json:"elapsed_time"`
	Distance float64 `json:"distance"`
	AvgHR    float64 `json:"average_heartrate"`
	Load     float64 `json:"icu_training_load"`
	Elev     float64 `json:"total_elevation_gain"`
}

func intervalsFetch(c intervalsConf, oldest string) ([]map[string]any, error) {
	q := url.Values{"oldest": {oldest}, "newest": {time.Now().AddDate(0, 0, 1).Format("2006-01-02")}}
	req, _ := http.NewRequest("GET", "https://intervals.icu/api/v1/athlete/"+url.PathEscape(c.Athlete)+"/activities?"+q.Encode(), nil)
	req.SetBasicAuth("API_KEY", c.Key)
	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("Couldn't reach intervals.icu. Check your internet connection.")
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 404 {
		return nil, fmt.Errorf("intervals.icu didn't accept that Athlete ID and API key.")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("intervals.icu returned %d", resp.StatusCode)
	}
	var list []icuActivity
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16<<20)).Decode(&list); err != nil {
		return nil, fmt.Errorf("intervals.icu sent something unexpected")
	}
	out := make([]map[string]any, 0, len(list))
	for _, a := range list {
		if a.Start == "" || (a.Moving == 0 && a.Elapsed == 0) {
			continue // e.g. Strava-only activities that intervals.icu can't share
		}
		out = append(out, map[string]any{"id": fmt.Sprint(a.ID), "name": a.Name, "type": a.Type, "start_date_local": a.Start,
			"moving_time": a.Moving, "elapsed_time": a.Elapsed, "distance": a.Distance, "average_heartrate": a.AvgHR,
			"suffer_score": a.Load, "total_elevation_gain": a.Elev})
	}
	return out, nil
}

// /api/intervals/activities?oldest=YYYY-MM-DD
func handleIntervalsActivities(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	c := loadIntervals()
	if c.Key == "" {
		writeErr(w, http.StatusUnauthorized, "not connected")
		return
	}
	oldest := r.URL.Query().Get("oldest")
	if _, err := time.Parse("2006-01-02", oldest); err != nil {
		oldest = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	items, err := intervalsFetch(c, oldest)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"items": items})
}

var activityCsvRe = regexp.MustCompile(`(?i)^activit(y|ies).*\.csv$`)

// /api/downloads/activities?since=<unix ms> hands back the newest activity CSV
// in the Downloads folder that is newer than since (only that file, read only).
func handleDownloadsActivities(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	home, err := os.UserHomeDir()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	dir := filepath.Join(home, "Downloads")
	ents, _ := os.ReadDir(dir)
	var best os.FileInfo
	for _, e := range ents {
		if e.IsDir() || !activityCsvRe.MatchString(e.Name()) {
			continue
		}
		fi, err := e.Info()
		if err != nil || fi.Size() > 20<<20 || fi.ModTime().UnixMilli() <= since {
			continue
		}
		if best == nil || fi.ModTime().After(best.ModTime()) {
			best = fi
		}
	}
	if best == nil {
		json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	b, err := os.ReadFile(filepath.Join(dir, best.Name()))
	if err != nil {
		json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"name": best.Name(), "mtime": best.ModTime().UnixMilli(), "text": string(b)})
}

// /api/intervals/wellness?oldest=YYYY-MM-DD: sleep, resting heart rate and
// steps that intervals.icu copies from Garmin Connect, for the Health & sleep
// page. Works without the browser extension.
func handleIntervalsWellness(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	c := loadIntervals()
	if c.Key == "" {
		writeErr(w, http.StatusUnauthorized, "not connected")
		return
	}
	oldest := r.URL.Query().Get("oldest")
	if _, err := time.Parse("2006-01-02", oldest); err != nil {
		oldest = time.Now().AddDate(0, 0, -14).Format("2006-01-02")
	}
	q := url.Values{"oldest": {oldest}, "newest": {time.Now().AddDate(0, 0, 1).Format("2006-01-02")}}
	req, _ := http.NewRequest("GET", "https://intervals.icu/api/v1/athlete/"+url.PathEscape(c.Athlete)+"/wellness?"+q.Encode(), nil)
	req.SetBasicAuth("API_KEY", c.Key)
	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "Couldn't reach intervals.icu.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		writeErr(w, http.StatusBadGateway, fmt.Sprintf("intervals.icu returned %d", resp.StatusCode))
		return
	}
	var list []map[string]any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&list); err != nil {
		writeErr(w, http.StatusBadGateway, "intervals.icu sent something unexpected")
		return
	}
	num := func(m map[string]any, k string) float64 { f, _ := m[k].(float64); return f }
	days := map[string]map[string]any{}
	for _, x := range list {
		d, _ := x["id"].(string)
		if !isYmd(d) {
			continue
		}
		day := map[string]any{}
		if v := num(x, "sleepSecs"); v > 0 {
			day["sleep"] = int(v/60 + .5)
		}
		if v := num(x, "sleepScore"); v > 0 {
			day["score"] = int(v + .5)
		}
		if v := num(x, "restingHR"); v > 0 {
			day["rhr"] = int(v + .5)
		}
		if v := num(x, "steps"); v > 0 {
			day["steps"] = int(v + .5)
		}
		if len(day) > 0 {
			days[d] = day
		}
	}
	json.NewEncoder(w).Encode(map[string]any{"days": days})
}
