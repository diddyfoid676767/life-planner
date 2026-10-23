package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// The planner reaches Claude through the user's own Missed info scheduled task on
// claude.ai, started with that task's API trigger. "Check email now" asks for an
// email check; the Ask Claude box sends a request, and Claude writes suggested
// changes that the user applies or skips in the planner. The token is kept in
// data/claude-link.json and never sent back to the page.
type claudeLink struct {
	Token string `json:"token"`
	Task  string `json:"task,omitempty"`
}

var taskRe = regexp.MustCompile(`^trig_[A-Za-z0-9]{8,64}$`)

func claudeLinkPath() string { return filepath.Join(dataDir, "claude-link.json") }

func loadClaudeLink() claudeLink {
	var c claudeLink
	if b, err := os.ReadFile(claudeLinkPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	if c.Task == "" && c.Token != "" && plannerTask != "" {
		// remember the task in the data folder, so builds without it still work
		c.Task = plannerTask
		if b, err := json.Marshal(c); err == nil {
			os.WriteFile(claudeLinkPath(), b, 0o600)
		}
	}
	return c
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func handleClaudeLink(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	conf := loadClaudeLink()
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]any{"configured": conf.Token != "" && conf.Task != ""})
	case http.MethodPut:
		var in struct {
			Token string `json:"token"`
			Task  string `json:"task"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		tok := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(in.Token), "Bearer "))
		if tok == "" {
			os.Remove(claudeLinkPath())
			json.NewEncoder(w).Encode(map[string]any{"configured": false})
			return
		}
		if !strings.HasPrefix(tok, "sk-ant-") || strings.ContainsAny(tok, " \t\r\n") {
			writeErr(w, http.StatusBadRequest, "That doesn't look like a scheduled task token. It starts with sk-ant-.")
			return
		}
		conf.Token = tok
		if t := strings.TrimSpace(in.Task); t != "" {
			if !taskRe.MatchString(t) {
				writeErr(w, http.StatusBadRequest, "That doesn't look like a scheduled task id. It starts with trig_.")
				return
			}
			conf.Task = t
		}
		b, _ := json.Marshal(conf)
		if err := os.WriteFile(claudeLinkPath(), b, 0o600); err != nil {
			writeErr(w, http.StatusInternalServerError, "Couldn't save the token.")
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"configured": true})
	case http.MethodPost:
		if conf.Token == "" || conf.Task == "" {
			writeErr(w, http.StatusNotFound, "not set up")
			return
		}
		msg := "EMAIL CHECK: Check email now was pressed in the Life Planner. Run the Missed info check now."
		body, _ := json.Marshal(map[string]string{"text": msg})
		req, _ := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/claude_code/routines/"+conf.Task+"/fire", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+conf.Token)
		req.Header.Set("anthropic-beta", "experimental-cc-routine-2026-04-01")
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
		if err != nil {
			writeErr(w, http.StatusBadGateway, "Couldn't reach Claude. Check your internet connection.")
			return
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
		switch {
		case resp.StatusCode < 300:
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case resp.StatusCode == 401 || resp.StatusCode == 403:
			writeErr(w, http.StatusUnauthorized, "Claude didn't accept the token. Paste a new one in Settings, App.")
		case resp.StatusCode == 429:
			writeErr(w, http.StatusTooManyRequests, "That's the limit for this hour. Try again a bit later.")
		default:
			writeErr(w, http.StatusBadGateway, "Claude couldn't start right now. Try again in a minute.")
		}
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}
