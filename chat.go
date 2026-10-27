package main

// In-app DMs and group chats, stored on the friends server. Row-level security
// means you can only read chats you're in, and every change goes through the
// server functions in supabase-2.22.7-chats-badges.sql, which check membership
// and blocks. The page polls: often while a chat is open, rarely otherwise.

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var chatFns = map[string]bool{"my_chats": true, "start_chat": true, "add_members": true, "rename_chat": true, "leave_chat": true,
	"send_message": true, "mark_read": true, "block_user": true, "unblock_user": true, "my_blocks": true, "report_user": true, "feedback_chat": true}

var chatIDRe = regexp.MustCompile(`^[0-9a-f-]{36}$`)

// GET /api/chat?c=<chat id>&after=<message id>: that chat's messages, oldest
// first (the newest 80 when after is 0). POST /api/chat {fn, args}: one of
// the chat functions.
func handleChat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if supaKey == "" {
		writeErr(w, http.StatusServiceUnavailable, "Chats aren't set up.")
		return
	}
	a, err := session()
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	switch r.Method {
	case http.MethodGet:
		c := r.URL.Query().Get("c")
		if !chatIDRe.MatchString(c) {
			writeErr(w, http.StatusBadRequest, "bad chat")
			return
		}
		after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
		var out []map[string]any
		path := "/rest/v1/messages?select=id,body,created_at,p:profiles(username)&chat_id=eq." + url.QueryEscape(c) + "&id=gt." + strconv.FormatInt(after, 10) + "&order=id.desc&limit=80"
		if code, err := supa("GET", path, a.Access, nil, &out); err != nil {
			chatErr(w, code, err)
			return
		}
		for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
			out[i], out[j] = out[j], out[i]
		}
		if out == nil {
			out = []map[string]any{}
		}
		json.NewEncoder(w).Encode(out)
	case http.MethodPost:
		var in struct {
			Fn   string         `json:"fn"`
			Args map[string]any `json:"args"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&in) != nil || !chatFns[in.Fn] {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		if in.Args == nil {
			in.Args = map[string]any{}
		}
		var out json.RawMessage
		if code, err := supa("POST", "/rest/v1/rpc/"+in.Fn, a.Access, in.Args, &out); err != nil {
			chatErr(w, code, err)
			return
		}
		if len(out) == 0 {
			out = json.RawMessage("null")
		}
		w.Write([]byte(`{"ok":true,"result":`))
		w.Write(out)
		w.Write([]byte("}"))
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

func chatErr(w http.ResponseWriter, code int, err error) {
	msg := err.Error()
	// the tables or functions aren't on the server yet
	if code == 404 || strings.Contains(msg, "Could not find") || strings.Contains(msg, "does not exist") {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{"error": "Chats are still being switched on. Try again soon.", "setup": true})
		return
	}
	if code == 0 {
		code = http.StatusBadGateway
	}
	if code < 400 || code >= 600 {
		code = http.StatusBadGateway
	}
	writeErr(w, code, msg)
}

// PUT /api/account/jersey {"n": 0-99 or null}: claim a jersey number. Numbers
// are unique on the server, so a taken one comes back 409 with who has it.
func handleAccountJersey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut || supaKey == "" {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		N *int `json:"n"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 1024)).Decode(&in) != nil || (in.N != nil && (*in.N < 0 || *in.N > 99)) {
		writeErr(w, http.StatusBadRequest, "Jersey numbers go from 0 to 99.")
		return
	}
	a, err := session()
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	code, err := supa("PATCH", "/rest/v1/profiles?id=eq."+url.QueryEscape(a.UserID), a.Access, map[string]any{"jersey": in.N}, nil, "Prefer", "return=minimal")
	if err == nil {
		w.Write([]byte(`{"ok":true}`))
		return
	}
	if code == 409 {
		var who []struct {
			Username string `json:"username"`
		}
		supa("GET", "/rest/v1/profiles?select=username&jersey=eq."+strconv.Itoa(*in.N), "", nil, &who)
		by := ""
		if len(who) > 0 {
			by = who[0].Username
		}
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]any{"error": "That number is taken.", "by": by})
		return
	}
	if code == 400 { // no jersey column yet: keep the number on this computer only
		w.Write([]byte(`{"ok":true,"local":true}`))
		return
	}
	writeErr(w, http.StatusBadGateway, err.Error())
}
