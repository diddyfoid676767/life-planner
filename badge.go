package main

import (
	"encoding/json"
	"io"
	"net/http"
)

// POST /api/badge {n}: the unread chat count, shown as a red dot on the
// planner's taskbar button.
func handleBadge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		N int `json:"n"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 256)).Decode(&in) != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	setTaskbarBadge(in.N)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"ok":true}`))
}
