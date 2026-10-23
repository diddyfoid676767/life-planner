package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// The Life Planner Connector Chrome extension reads due work, assessments and
// news from the school portal (Schoolbox) while the user is logged in, and
// assignments from Microsoft Teams (ids starting mwb-t), and posts them here.
// They are kept in data/school-portal.json and shown in Missed info next to
// the email summaries, so dated school work flows into the planner the same way.

const portalFile = "school-portal.json"

type portalItem struct {
	ID       string `json:"id"`
	Source   string `json:"source"`
	Category string `json:"category"`
	Subject  string `json:"subject"`
	Summary  string `json:"summary"`
	From     string `json:"from"`
	Received string `json:"received"`
	Due      string `json:"due"`
	Time     string `json:"time,omitempty"`
	Link     string `json:"link"`
}

type portalDoc struct {
	Updated string       `json:"updated"`
	Items   []portalItem `json:"items"`
}

func cut(s string, n int) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

func isYmd(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func handlePortal(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	path := filepath.Join(dataDir, portalFile)
	switch r.Method {
	case http.MethodGet:
		var doc portalDoc
		if b, err := os.ReadFile(path); err == nil {
			json.Unmarshal(b, &doc)
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "app": "life-planner", "version": version, "updated": doc.Updated, "count": len(doc.Items)})
	case http.MethodPost:
		var in portalDoc
		if err := json.NewDecoder(io.LimitReader(r.Body, 2<<20)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		out := portalDoc{Updated: time.Now().UTC().Format(time.RFC3339), Items: []portalItem{}}
		seen := map[string]bool{}
		for _, x := range in.Items {
			if !strings.HasPrefix(x.ID, "mwb-") || len(x.ID) > 120 || seen[x.ID] || strings.TrimSpace(x.Subject) == "" {
				continue
			}
			seen[x.ID] = true
			x.Source = "School portal"
			if strings.HasPrefix(x.ID, "mwb-t") {
				x.Source = "Teams"
			}
			x.Category = cut(x.Category, 30)
			x.Subject = cut(x.Subject, 200)
			x.Summary = cut(x.Summary, 600)
			x.From = cut(x.From, 100)
			x.Received = cut(x.Received, 40)
			if !isYmd(x.Due) {
				x.Due = ""
			}
			if len(x.Time) != 5 || x.Time[2] != ':' {
				x.Time = ""
			}
			if !linkOK(x.Link) || len(x.Link) > 500 {
				x.Link = ""
			}
			out.Items = append(out.Items, x)
			if len(out.Items) == 400 {
				break
			}
		}
		b, _ := json.MarshalIndent(out, "", " ")
		mu.Lock()
		err := saveAtomic(path, b)
		mu.Unlock()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "count": len(out.Items), "updated": out.Updated})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

// withPortal adds the school portal items to the email summary that
// /api/inbox serves. "updated" becomes the later of the two times so the page
// notices a change to either.
func withPortal(email []byte) []byte {
	b, err := os.ReadFile(filepath.Join(dataDir, portalFile))
	var mwb portalDoc
	if err != nil || json.Unmarshal(b, &mwb) != nil || len(mwb.Items) == 0 {
		return email
	}
	doc := map[string]any{}
	if email != nil && json.Unmarshal(email, &doc) != nil {
		return email
	}
	items, _ := doc["items"].([]any)
	for _, x := range mwb.Items {
		items = append(items, x)
	}
	doc["items"] = items
	if u, _ := doc["updated"].(string); u < mwb.Updated {
		doc["updated"] = mwb.Updated
	}
	if s, _ := doc["summary"].(string); s == "" {
		doc["summary"] = "School work and news from your school portal."
	}
	out, err := json.Marshal(doc)
	if err != nil {
		return email
	}
	return out
}

// linkOK keeps plain https links, which the page opens in a new tab.
func linkOK(l string) bool {
	return strings.HasPrefix(l, "https://") && !strings.ContainsAny(l, " \t\r\n\"'<>")
}
