package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"time"
)

// The Life Planner Connector Chrome extension reads recent activities from
// strava.com and connect.garmin.com while the user is logged in there (no API app or
// subscription needed) and posts them here. They're kept in
// data/browser-activities.json, and the page turns them into workouts the same
// way as the Strava and intervals.icu syncs.

const browserActsFile = "browser-activities.json"

type browserAct struct {
	Src       string  `json:"src"`
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Start     string  `json:"start_date_local"`
	Moving    float64 `json:"moving_time"`
	Elapsed   float64 `json:"elapsed_time"`
	Distance  float64 `json:"distance"`
	AvgHR     float64 `json:"average_heartrate"`
	Suffer    float64 `json:"suffer_score"`
	Elevation float64 `json:"total_elevation_gain"`
}

var (
	browserActsSrc = map[string]bool{"strava": true, "garmin": true}
	browserActID   = regexp.MustCompile(`^[\w-]{1,40}$`)
	localStartRe   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`)
)

func loadBrowserActs() map[string]browserAct {
	out := map[string]browserAct{}
	var list []browserAct
	if b, err := os.ReadFile(filepath.Join(dataDir, browserActsFile)); err == nil {
		json.Unmarshal(b, &list)
	}
	for _, a := range list {
		out[a.Src+":"+a.ID] = a
	}
	return out
}

func handleBrowserActivities(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	path := filepath.Join(dataDir, browserActsFile)
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		all := loadBrowserActs()
		mu.Unlock()
		items := make([]browserAct, 0, len(all))
		for _, a := range all {
			items = append(items, a)
		}
		sort.Slice(items, func(i, j int) bool { return items[i].Start > items[j].Start })
		json.NewEncoder(w).Encode(map[string]any{"items": items})
	case http.MethodPost:
		var in struct {
			Items []browserAct `json:"items"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		mu.Lock()
		defer mu.Unlock()
		all := loadBrowserActs()
		added := 0
		for _, a := range in.Items {
			if !browserActsSrc[a.Src] || !browserActID.MatchString(a.ID) || !localStartRe.MatchString(a.Start) {
				continue
			}
			a.Name, a.Type, a.Start = cut(a.Name, 120), cut(a.Type, 40), a.Start[:16]
			if _, ok := all[a.Src+":"+a.ID]; !ok {
				added++
			}
			all[a.Src+":"+a.ID] = a
		}
		// keep the last 120 days
		old := time.Now().AddDate(0, 0, -120).Format("2006-01-02")
		list := make([]browserAct, 0, len(all))
		for _, a := range all {
			if a.Start >= old {
				list = append(list, a)
			}
		}
		sort.Slice(list, func(i, j int) bool { return list[i].Start > list[j].Start })
		b, _ := json.MarshalIndent(list, "", " ")
		if err := saveAtomic(path, b); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "added": added, "count": len(list)})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

// Sleep, steps, resting heart rate and body battery from Garmin Connect, one
// entry per day (the morning you woke up), kept for 60 days in
// data/browser-health.json. The Health & sleep page reads them.

const browserHealthFile = "browser-health.json"

var (
	healthNums = map[string]float64{"sleep": 24 * 60, "deep": 24 * 60, "light": 24 * 60, "rem": 24 * 60, "awake": 24 * 60, "score": 100, "steps": 200000, "rhr": 250, "bb": 100, "stress": 100}
	hhmmRe     = regexp.MustCompile(`^\d{2}:\d{2}$`)
)

func loadBrowserHealth() map[string]map[string]any {
	days := map[string]map[string]any{}
	if b, err := os.ReadFile(filepath.Join(dataDir, browserHealthFile)); err == nil {
		json.Unmarshal(b, &days)
	}
	return days
}

func handleBrowserHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		days := loadBrowserHealth()
		mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"days": days})
	case http.MethodPost:
		var in struct {
			Days map[string]map[string]any `json:"days"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		mu.Lock()
		defer mu.Unlock()
		days := loadBrowserHealth()
		for d, v := range in.Days {
			if !isYmd(d) {
				continue
			}
			day := days[d]
			if day == nil {
				day = map[string]any{}
			}
			for k, x := range v {
				if max, ok := healthNums[k]; ok {
					if f, ok := x.(float64); ok && f > 0 && f <= max {
						day[k] = float64(int(f + .5))
					}
				} else if (k == "bed" || k == "wake") && hhmmRe.MatchString(fmt.Sprint(x)) {
					day[k] = x
				}
			}
			if len(day) > 0 {
				days[d] = day
			}
		}
		old := time.Now().AddDate(0, 0, -60).Format("2006-01-02")
		for d := range days {
			if d < old {
				delete(days, d)
			}
		}
		b, _ := json.MarshalIndent(days, "", " ")
		if err := saveAtomic(filepath.Join(dataDir, browserHealthFile), b); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "days": len(days)})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}
