package main

// In-app DMs and group chats, stored on the friends server. You can only read
// chats you're in, and firestore.rules checks membership, blocks, sizes and
// rate limits on every write. The page polls: often while a chat is open,
// rarely otherwise.
//
// chats/<id> holds the members (uids), name, the last message and how far
// each member has read; chats/<id>/msgs/<n> the messages, n being the time
// sent in microseconds (so ids grow, as the page expects).

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var chatIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)

// GET /api/chat?c=<chat id>&after=<message id>: that chat's messages, oldest
// first (the newest 80 when after is 0). POST /api/chat {fn, args}: one of
// the chat functions.
func handleChat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if !fbOn() {
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
		docs, err := fsQuery(a.Access, "chats/"+c, map[string]any{"from": []map[string]string{{"collectionId": "msgs"}},
			"where":   fsWhere("n", "GREATER_THAN", after),
			"orderBy": []any{map[string]any{"field": map[string]string{"fieldPath": "n"}, "direction": "DESCENDING"}}, "limit": 80})
		if err != nil {
			chatErr(w, err)
			return
		}
		out := []map[string]any{}
		for i := len(docs) - 1; i >= 0; i-- {
			f := docs[i].Fields
			out = append(out, map[string]any{"id": int64(num(f["n"])), "body": f["body"], "created_at": f["at"], "p": map[string]any{"username": f["u"]}})
		}
		json.NewEncoder(w).Encode(out)
	case http.MethodPost:
		var in struct {
			Fn   string         `json:"fn"`
			Args map[string]any `json:"args"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&in) != nil || chatFns[in.Fn] == nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		if in.Args == nil {
			in.Args = map[string]any{}
		}
		res, err := chatFns[in.Fn](a, in.Args)
		if err != nil {
			chatErr(w, err)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": res})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

func chatErr(w http.ResponseWriter, err error) {
	code := http.StatusBadGateway
	if e, ok := err.(*fbErr); ok && e.Code >= 400 && e.Code < 500 {
		code = e.Code
	} else if _, ok := err.(userErr); ok {
		code = http.StatusBadRequest
	}
	writeErr(w, code, err.Error())
}

type userErr string

func (e userErr) Error() string { return string(e) }

var chatFns map[string]func(*account, map[string]any) (any, error)

func init() {
	chatFns = map[string]func(*account, map[string]any) (any, error){
		"my_chats": myChats, "start_chat": startChat, "add_members": addMembers, "rename_chat": renameChat,
		"leave_chat": leaveChat, "send_message": sendMessage, "mark_read": markRead, "block_user": blockUser,
		"unblock_user": unblockUser, "my_blocks": myBlocks, "report_user": reportUser, "feedback_chat": feedbackChat,
	}
}

func argStr(m map[string]any, k string) string { s, _ := m[k].(string); return strings.TrimSpace(s) }

func argChat(m map[string]any) (string, error) {
	c := argStr(m, "c")
	if !chatIDRe.MatchString(c) {
		return "", userErr("bad chat")
	}
	return c, nil
}

func strList(v any) []string {
	var out []string
	l, _ := v.([]any)
	for _, x := range l {
		if s, ok := x.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// uidsOf looks up usernames; it fails on one that doesn't exist.
func uidsOf(a *account, names []string) ([]string, error) {
	var paths []string
	for _, n := range names {
		n = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(n), "@"))
		if !usernameRe.MatchString(n) {
			return nil, userErr("No one is called @" + n + ".")
		}
		paths = append(paths, "usernames/"+n)
	}
	got, err := fsGetMany(a.Access, paths)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, p := range paths {
		d := got[p]
		if d == nil {
			return nil, userErr("No one is called @" + strings.TrimPrefix(p, "usernames/") + ".")
		}
		out = append(out, str(d.Fields["uid"]))
	}
	return out, nil
}

// stamp records the time of a rate-limited action (rl/<uid>.<k>) in the same commit.
func stamp(a *account, k string) fsWrite {
	return fsWrite{"update": map[string]any{"name": fsName("rl/" + a.UserID), "fields": map[string]any{}},
		"updateMask": map[string]any{"fieldPaths": []string{}}, "updateTransforms": []map[string]string{{"fieldPath": k, "setToServerValue": "REQUEST_TIME"}}}
}

func slowDown(err error) error {
	if fbStatus(err) == "PERMISSION_DENIED" {
		return userErr("Slow down a bit, or you can't do that here. Try again in a few seconds.")
	}
	return err
}

func myChats(a *account, _ map[string]any) (any, error) {
	chats, err := fsQuery(a.Access, "", map[string]any{"from": []map[string]string{{"collectionId": "chats"}}, "where": fsWhere("members", "ARRAY_CONTAINS", a.UserID), "limit": 100})
	if err != nil {
		return nil, err
	}
	blocks, _ := myBlockList(a)
	blocked := map[string]bool{}
	for _, b := range blocks {
		blocked[b] = true
	}
	need := map[string]bool{}
	for _, c := range chats {
		for _, m := range strList(c.Fields["members"]) {
			need["profiles/"+m] = true
		}
	}
	var paths []string
	for p := range need {
		paths = append(paths, p)
	}
	profs, err := fsGetMany(a.Access, paths)
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for _, c := range chats {
		f := c.Fields
		var members []map[string]any
		for _, m := range strList(f["members"]) {
			if p := profs["profiles/"+m]; p != nil {
				var av any
				if s := str(p.Fields["avatar"]); s != "" && json.Valid([]byte(s)) {
					av = json.RawMessage(s)
				}
				members = append(members, map[string]any{"u": p.Fields["username"], "d": p.Fields["display"], "av": av, "b": p.Fields["badges"]})
			}
		}
		sort.Slice(members, func(i, j int) bool { return str(members[i]["u"]) < str(members[j]["u"]) })
		row := map[string]any{"id": c.ID, "name": f["name"], "is_group": f["group"], "last_at": f["at"], "members": members, "last": nil, "unread": 0}
		read := int64(0)
		if rm, ok := f["read"].(map[string]any); ok {
			read = int64(num(rm[a.UserID]))
		}
		if l, ok := f["last"].(map[string]any); ok {
			id := int64(num(l["id"]))
			row["last"] = map[string]any{"id": id, "body": l["body"], "at": l["at"], "u": l["u"]}
			row["last_at"] = l["at"]
			if id > read && str(l["from"]) != a.UserID {
				msgs, err := fsQuery(a.Access, "chats/"+c.ID, map[string]any{"from": []map[string]string{{"collectionId": "msgs"}},
					"where": fsWhere("n", "GREATER_THAN", read), "select": map[string]any{"fields": []map[string]string{{"fieldPath": "from"}, {"fieldPath": "u"}}}, "limit": 99})
				if err == nil {
					n := 0
					for _, m := range msgs {
						if str(m.Fields["from"]) != a.UserID && !blocked[str(m.Fields["u"])] {
							n++
						}
					}
					row["unread"] = n
				}
			}
		}
		out = append(out, row)
	}
	sort.SliceStable(out, func(i, j int) bool { return str(out[i]["last_at"]) > str(out[j]["last_at"]) })
	return out, nil
}

func newChat(a *account, id string, members []string, name string, group bool, kind string) error {
	_, err := fsCommit(a.Access, stamp(a, "c"),
		fsSet("chats/"+id, map[string]any{"members": members, "name": name, "group": group, "by": a.UserID, "kind": kind, "last": nil, "read": map[string]any{}}, false, "new", "at"))
	return err
}

func startChat(a *account, args map[string]any) (any, error) {
	names := strList(args["names"])
	if len(names) == 0 || len(names) > 49 {
		return nil, userErr("Pick who to chat with.")
	}
	uids, err := uidsOf(a, names)
	if err != nil {
		return nil, err
	}
	members := []string{a.UserID}
	seen := map[string]bool{a.UserID: true}
	for _, u := range uids {
		if !seen[u] {
			seen[u] = true
			members = append(members, u)
		}
	}
	if len(members) < 2 {
		return nil, userErr("That's you!")
	}
	title, hasTitle := args["title"].(string)
	if len(members) == 2 && !hasTitle {
		x, y := members[0], members[1]
		if y < x {
			x, y = y, x
		}
		id := "dm-" + x + "-" + y
		if d, err := fsGet(a.Access, "chats/"+id, "group"); d != nil {
			return id, nil
		} else if fbStatus(err) == "PERMISSION_DENIED" {
			return nil, userErr("You left your chat with this person, so it can't be started again.")
		}
		if err := newChat(a, id, []string{x, y}, "", false, ""); err != nil {
			if fbStatus(err) == "PERMISSION_DENIED" {
				return nil, userErr("You can't message this person.")
			}
			return nil, slowDown(err)
		}
		return id, nil
	}
	id := newID()
	if err := newChat(a, id, members, cut(strings.TrimSpace(title), 40), true, ""); err != nil {
		return nil, slowDown(err)
	}
	return id, nil
}

func getChat(a *account, c string) (*fsDoc, error) {
	d, err := fsGet(a.Access, "chats/"+c)
	if d == nil && (err == nil || fbStatus(err) == "PERMISSION_DENIED") {
		return nil, userErr("You're not in that chat.")
	}
	return d, err
}

func addMembers(a *account, args map[string]any) (any, error) {
	c, err := argChat(args)
	if err != nil {
		return nil, err
	}
	ch, err := getChat(a, c)
	if err != nil {
		return nil, err
	}
	if ch.Fields["group"] != true || str(ch.Fields["kind"]) != "" {
		return nil, userErr("You can only add people to group chats.")
	}
	uids, err := uidsOf(a, strList(args["names"]))
	if err != nil {
		return nil, err
	}
	members := strList(ch.Fields["members"])
	added := 0
	for _, u := range uids {
		if !containsStr(members, u) {
			members = append(members, u)
			added++
		}
	}
	if len(members) > 50 {
		return nil, userErr("Group chats hold up to 50 people.")
	}
	if added == 0 {
		return 0, nil
	}
	if _, err := fsCommit(a.Access, stamp(a, "c"), fsSet("chats/"+c, map[string]any{"members": members}, true, ch.Updated)); err != nil {
		return nil, slowDown(err)
	}
	return added, nil
}

func containsStr(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

func renameChat(a *account, args map[string]any) (any, error) {
	c, err := argChat(args)
	if err != nil {
		return nil, err
	}
	_, err = fsCommit(a.Access, fsSet("chats/"+c, map[string]any{"name": cut(argStr(args, "title"), 40)}, true, "old"))
	if fbStatus(err) == "PERMISSION_DENIED" {
		return nil, userErr("Only group chats can be renamed.")
	}
	return nil, err
}

func leaveChat(a *account, args map[string]any) (any, error) {
	c, err := argChat(args)
	if err != nil {
		return nil, err
	}
	ch, err := getChat(a, c)
	if err != nil {
		return nil, err
	}
	var rest []string
	for _, m := range strList(ch.Fields["members"]) {
		if m != a.UserID {
			rest = append(rest, m)
		}
	}
	if rest == nil {
		rest = []string{}
	}
	_, err = fsCommit(a.Access, fsSet("chats/"+c, map[string]any{"members": rest}, true, ch.Updated))
	return nil, err
}

func sendMessage(a *account, args map[string]any) (any, error) {
	c, err := argChat(args)
	if err != nil {
		return nil, err
	}
	body := argStr(args, "body")
	if body == "" {
		return nil, userErr("Type a message first.")
	}
	if len(body) > 2000 {
		body = cut(body, 2000)
		for len(body) > 2000 { // cut counts characters; the rules count bytes of UTF-8... keep it safe
			r := []rune(body)
			body = string(r[:len(r)-1])
		}
	}
	now := time.Now()
	n := now.UnixMicro()
	last := map[string]any{"id": n, "body": cut(body, 120), "at": now.UTC().Format(time.RFC3339Nano), "u": a.Username, "from": a.UserID}
	_, err = fsCommit(a.Access, stamp(a, "m"),
		fsSet(fmt.Sprintf("chats/%s/msgs/%d", c, n), map[string]any{"n": n, "from": a.UserID, "u": a.Username, "body": body}, false, "new", "at"),
		fsSet("chats/"+c, map[string]any{"last": last, "read." + a.UserID: n}, true, "old", "at"))
	if err != nil {
		if fbStatus(err) == "PERMISSION_DENIED" {
			if _, e := getChat(a, c); e != nil {
				return nil, e
			}
			return nil, userErr("Slow down a bit, or you can't message this person. Try again in a few seconds.")
		}
		return nil, err
	}
	return n, nil
}

func markRead(a *account, args map[string]any) (any, error) {
	c, err := argChat(args)
	if err != nil {
		return nil, err
	}
	ch, err := getChat(a, c)
	if err != nil {
		return nil, err
	}
	l, _ := ch.Fields["last"].(map[string]any)
	if l == nil {
		return nil, nil
	}
	_, err = fsCommit(a.Access, fsSet("chats/"+c, map[string]any{"read." + a.UserID: int64(num(l["id"]))}, true, "old"))
	return nil, err
}

func blockUser(a *account, args map[string]any) (any, error) {
	name := strings.ToLower(argStr(args, "name"))
	uids, err := uidsOf(a, []string{name})
	if err != nil {
		return nil, err
	}
	if uids[0] == a.UserID {
		return nil, userErr("You can't block yourself.")
	}
	_, err = fsCommit(a.Access, fsSet("blocks/"+a.UserID+"_"+uids[0], map[string]any{"by": a.UserID, "who": uids[0], "u": name}, false, ""))
	return nil, err
}

func unblockUser(a *account, args map[string]any) (any, error) {
	uids, err := uidsOf(a, []string{argStr(args, "name")})
	if err != nil {
		return nil, err
	}
	_, err = fsCommit(a.Access, fsDel("blocks/"+a.UserID+"_"+uids[0]))
	return nil, err
}

func myBlockList(a *account) ([]string, error) {
	docs, err := fsQuery(a.Access, "", map[string]any{"from": []map[string]string{{"collectionId": "blocks"}}, "where": fsWhere("by", "EQUAL", a.UserID), "limit": 500})
	out := []string{}
	for _, d := range docs {
		out = append(out, str(d.Fields["u"]))
	}
	return out, err
}

func myBlocks(a *account, _ map[string]any) (any, error) { return myBlockList(a) }

func reportUser(a *account, args map[string]any) (any, error) {
	name := strings.ToLower(argStr(args, "name"))
	if !usernameRe.MatchString(name) {
		return nil, userErr("No one is called @" + name + ".")
	}
	msg, _ := toF(args["msg"])
	_, err := fsCommit(a.Access, stamp(a, "r"),
		fsSet("reports/"+newID(), map[string]any{"by": a.UserID, "u": name, "msg": int64(msg), "why": cut(argStr(args, "why"), 500)}, false, "new", "at"))
	return nil, slowDown(err)
}

// feedbackChat returns your chat with the developer, starting it (or
// bringing the developer back into it) when needed.
func feedbackChat(a *account, _ map[string]any) (any, error) {
	if a.Username == devName {
		return nil, userErr("You're the developer: feedback from everyone else arrives in your chats.")
	}
	dev, err := uidsOf(a, []string{devName})
	if err != nil {
		return nil, userErr("Feedback isn't switched on yet.")
	}
	id := "fb-" + a.UserID
	ch, err := fsGet(a.Access, "chats/"+id)
	if err != nil && fbStatus(err) != "PERMISSION_DENIED" {
		return nil, err
	}
	if ch == nil && err == nil {
		if err := newChat(a, id, []string{a.UserID, dev[0]}, cut("Feedback · @"+a.Username, 40), true, "feedback"); err != nil {
			return nil, slowDown(err)
		}
		return id, nil
	}
	if ch != nil && !containsStr(strList(ch.Fields["members"]), dev[0]) {
		if _, err := fsCommit(a.Access, fsSet("chats/"+id, map[string]any{"members": append(strList(ch.Fields["members"]), dev[0])}, true, ch.Updated)); err != nil {
			return nil, err
		}
	}
	return id, nil
}

// PUT /api/account/jersey {"n": 0-99 or null}: claim a jersey number. Numbers
// are unique on the server, so a taken one comes back 409 with who has it.
func handleAccountJersey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut || !fbOn() {
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
	err = claimJersey(a, in.N)
	if err == nil {
		w.Write([]byte(`{"ok":true}`))
		return
	}
	if in.N != nil {
		if d, _ := fsGet("", fmt.Sprintf("jerseys/%d", *in.N)); d != nil {
			by := ""
			if p, _ := fsGet("", "profiles/"+str(d.Fields["uid"]), "username"); p != nil {
				by = str(p.Fields["username"])
			}
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]any{"error": "That number is taken.", "by": by})
			return
		}
	}
	writeErr(w, http.StatusBadGateway, err.Error())
}
