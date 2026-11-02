package main

// Runs against the Firebase emulators with the real firestore.rules:
//   npx firebase emulators:exec --project demo-lp "LP_FB_EMU=1 go test -tags noseed -run Emu ./..."

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

func emu(t *testing.T) {
	if os.Getenv("LP_FB_EMU") == "" {
		t.Skip("needs the emulators")
	}
	fbKey, fbProject = "fake", "demo-lp"
	fbAuthURL, fbTokURL = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1", "http://127.0.0.1:9099/securetoken.googleapis.com/v1"
	fbDocURL = "http://127.0.0.1:8080/v1"
	supaURL = "http://127.0.0.1:1" // the old server isn't there
}

func mustUser(t *testing.T, name string) *account {
	a, err := signUp(name, "password123")
	if err != nil {
		t.Fatalf("signup %s: %v", name, err)
	}
	return a
}

func denied(t *testing.T, what string, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: the rules let it through", what)
	}
}

func TestEmuEverything(t *testing.T) {
	emu(t)
	sfx := fmt.Sprint(time.Now().UnixNano() % 100000)
	dev := mustUser(t, devName)
	ann, bob := mustUser(t, "ann"+sfx), mustUser(t, "bob"+sfx)
	if _, err := signUp("ann"+sfx, "password123"); err == nil {
		t.Fatal("same username twice")
	}
	if a, _, err := logIn("ann"+sfx, "password123"); err != nil || a.UserID != ann.UserID {
		t.Fatalf("login: %v", err)
	}
	if _, _, err := logIn("ann"+sfx, "wrongpass1"); err == nil || !strings.Contains(err.Error(), "Wrong") {
		t.Fatalf("wrong password: %v", err)
	}
	if p, _ := fsGet("", "profiles/"+dev.UserID); p == nil || fmt.Sprint(p.Fields["badges"]) != "[dev]" {
		t.Fatalf("dev badge: %v", p)
	}

	// ---- leaderboard
	now := time.Now()
	wk := now.AddDate(0, 0, -((int(now.Weekday())+6)%7)).Format("2006-01-02")
	stats := map[string]any{"week": wk, "study": map[string]any{"mins": 30.0, "coins": 100.0}, "fr": []any{"bob" + sfx}}
	if _, err := publishProfile(ann, "Ann", `{"c":1}`, stats, now); err == nil {
		// created at signup, so this is an update within 20s: it waits
	}
	// pretend the last save was a while ago by publishing "later" (the server clock decides; rules use request.time)
	// so instead check the direct cheats the rules must refuse:
	cheat := map[string]any{"display": "Ann", "avatar": "", "stats": map[string]any{"week": wk, "study": map[string]any{"coins": 999999.0}}}
	_, err := fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, cheat, true, "", "updated_at"))
	denied(t, "999999 coins", err)
	_, err = fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, map[string]any{"badges": []any{"dev"}}, true, ""))
	denied(t, "dev badge", err)
	_, err = fsCommit(ann.Access, fsSet("profiles/"+bob.UserID, map[string]any{"display": "hacked"}, true, ""))
	denied(t, "someone else's profile", err)
	_, err = fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, map[string]any{"display": "Ann", "avatar": strings.Repeat("x", 7000), "stats": map[string]any{}}, true, "", "updated_at"))
	denied(t, "huge avatar", err)
	_, err = fsCommit(ann.Access, fsSet("usernames/"+"zed"+sfx, map[string]any{"uid": ann.UserID}, false, "new"))
	denied(t, "second username", err)
	// a fresh account can't start with a mountain of coins either
	eve := mustUser(t, "eve"+sfx)
	fsCommit(eve.Access, fsDel("profiles/"+eve.UserID))
	_, err = fsCommit(eve.Access, fsSet("profiles/"+eve.UserID, map[string]any{"username": "eve" + sfx, "display": "", "avatar": "", "badges": []any{}, "jersey": nil,
		"stats": map[string]any{"week": wk, "study": map[string]any{"mins": 99999.0}}}, false, "new", "born", "updated_at"))
	denied(t, "99999 minutes this week", err)

	// an honest save after 20s goes through, clamped
	time.Sleep(22 * time.Second)
	// past the 20s gap, so only the coin rules can refuse these
	_, err = fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, cheat, true, "", "updated_at"))
	denied(t, "999999 coins after 20s", err)
	_, err = fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, map[string]any{"display": "Ann", "avatar": "", "stats": map[string]any{"week": wk, "study": map[string]any{"coins": 5000.0}}}, true, "", "updated_at"))
	denied(t, "5000 coins in half a minute", err)
	_, err = fsCommit(ann.Access, fsSet("profiles/"+ann.UserID, map[string]any{"display": "Ann", "avatar": "", "stats": map[string]any{"week": wk, "study": map[string]any{"mins": 30000.0}}}, true, "", "updated_at"))
	denied(t, "500 hours studied this week", err)
	if later, err := publishProfile(ann, "Ann", `{"c":1}`, map[string]any{"week": wk, "study": map[string]any{"mins": 30.0, "coins": 50000.0},
		"st": map[string]any{"t": 1.0, "s": "Maths", "at": 1.0, "p": 0.0, "x": 1.0}, "ss": map[string]any{"id": "2026-4", "s": 30.0, "k": 0.0, "tr": 1.0},
		"yr": map[string]any{"y": 2026.0, "tr": 5.0, "w": 2.0}, "cw": map[string]any{"wk": wk, "v": 3.0}, "pw": map[string]any{"wk": wk, "v": 1.0},
		"gr": map[string]any{"m": 1.0, "r": 0.0, "y": 2026.0, "o": 81.5, "s": "Maths=88"},
		"fo": map[string]any{"n": 1.0, "t": "oak:45:4dabf7:0"}}, time.Now()); err != nil || later {
		t.Fatalf("publish: %v %v", later, err)
	}
	p, _ := fsGet("", "profiles/"+ann.UserID)
	if c := getStat(p.Fields["stats"].(map[string]any), "study", "coins"); c <= 0 || c > 600 {
		t.Fatalf("coins clamped to %v", c)
	}
	if gr, _ := p.Fields["stats"].(map[string]any)["gr"].(map[string]any); gr == nil || gr["o"] != 81.5 || p.Fields["stats"].(map[string]any)["fo"] == nil {
		t.Fatalf("2.40 stats not saved: %v", p.Fields["stats"])
	}

	// ---- jersey
	if err := claimJersey(ann, ptr(7)); err != nil {
		t.Fatalf("jersey: %v", err)
	}
	denied(t, "taken jersey", claimJersey(bob, ptr(7)))

	// ---- chats
	id, err := startChat(ann, map[string]any{"names": []any{"bob" + sfx}})
	if err != nil {
		t.Fatalf("dm: %v", err)
	}
	if id2, _ := startChat(bob, map[string]any{"names": []any{"ann" + sfx}}); id2 != id {
		t.Fatal("second DM")
	}
	if _, err := sendMessage(ann, map[string]any{"c": id, "body": "hi bob"}); err != nil {
		t.Fatalf("send: %v", err)
	}
	_, err = sendMessage(ann, map[string]any{"c": id, "body": "again"})
	denied(t, "two messages in a second", err)
	time.Sleep(1100 * time.Millisecond)
	if _, err := sendMessage(ann, map[string]any{"c": id, "body": "again"}); err != nil {
		t.Fatalf("send 2: %v", err)
	}
	l, err := myChats(bob, nil)
	if err != nil {
		t.Fatalf("my chats: %v", err)
	}
	rows := l.([]map[string]any)
	if len(rows) != 1 || rows[0]["unread"] != 2 || len(rows[0]["members"].([]map[string]any)) != 2 {
		t.Fatalf("bob's chats: %v", rows)
	}
	if _, err := markRead(bob, map[string]any{"c": id}); err != nil {
		t.Fatalf("read: %v", err)
	}
	if l, _ := myChats(bob, nil); l.([]map[string]any)[0]["unread"] != 0 {
		t.Fatal("still unread")
	}
	_, err = fsGet(eve.Access, "chats/"+id.(string))
	denied(t, "reading someone else's chat", err)
	_, err = sendMessage(eve, map[string]any{"c": id, "body": "let me in"})
	denied(t, "posting in someone else's chat", err)
	if _, err := blockUser(bob, map[string]any{"name": "ann" + sfx}); err != nil {
		t.Fatalf("block: %v", err)
	}
	time.Sleep(1100 * time.Millisecond)
	_, err = sendMessage(ann, map[string]any{"c": id, "body": "blocked?"})
	denied(t, "messaging someone who blocked you", err)
	if b, _ := myBlocks(bob, nil); len(b.([]string)) != 1 {
		t.Fatal("blocks")
	}
	time.Sleep(3100 * time.Millisecond)
	g, err := startChat(ann, map[string]any{"names": []any{"eve" + sfx}, "title": "Study"})
	if err != nil {
		t.Fatalf("group: %v", err)
	}
	time.Sleep(3100 * time.Millisecond)
	if n, err := addMembers(eve, map[string]any{"c": g, "names": []any{"bob" + sfx}}); err != nil || n != 1 {
		t.Fatalf("add: %v %v", n, err)
	}
	if _, err := leaveChat(bob, map[string]any{"c": g}); err != nil {
		t.Fatalf("leave: %v", err)
	}

	// ---- feedback
	fb, err := feedbackChat(ann, nil)
	if err != nil {
		t.Fatalf("feedback: %v", err)
	}
	time.Sleep(1100 * time.Millisecond)
	if _, err := sendMessage(ann, map[string]any{"c": fb, "body": "bug: x"}); err != nil {
		t.Fatalf("feedback send: %v", err)
	}
	if l, _ := myChats(dev, nil); len(l.([]map[string]any)) != 1 {
		t.Fatalf("dev's chats: %v", l)
	}
	_, err = fsCommit(bob.Access, fsSet("chats/fb-"+bob.UserID, map[string]any{"members": []any{bob.UserID, eve.UserID}, "name": "x", "group": true, "by": bob.UserID, "kind": "feedback", "last": nil, "read": map[string]any{}}, false, "new", "at"))
	denied(t, "feedback chat to someone else", err)
	if _, err := reportUser(bob, map[string]any{"name": "ann" + sfx, "why": "spam"}); err != nil {
		t.Fatalf("report: %v", err)
	}

	// ---- planner sync
	at, err := cloud.create(ann, []byte(`{"todos":[]}`))
	if err != nil {
		t.Fatalf("planner create: %v", err)
	}
	if _, err := cloud.create(ann, []byte(`{}`)); err != errCloudChanged {
		t.Fatalf("second create: %v", err)
	}
	time.Sleep(2100 * time.Millisecond)
	at2, err := cloud.update(ann, []byte(`{"todos":[{"id":"a"}]}`), at)
	if err != nil {
		t.Fatalf("planner update: %v", err)
	}
	time.Sleep(2100 * time.Millisecond)
	if _, err := cloud.update(ann, []byte(`{}`), at); err != errCloudChanged {
		t.Fatalf("stale update: %v", err)
	}
	if row, ok, _ := cloud.get(ann); !ok || row.UpdatedAt != at2 || !strings.Contains(string(row.Data), `"a"`) {
		t.Fatalf("planner get: %v", row)
	}
	_, err = fsGet(bob.Access, "planner/"+ann.UserID)
	denied(t, "reading someone else's planner", err)

	// ---- people
	docs, err := fsQuery("", "", map[string]any{"from": []map[string]string{{"collectionId": "profiles"}}, "where": fsWhere("username", "IN", []any{"ann" + sfx, "bob" + sfx})})
	if err != nil || len(docs) != 2 {
		t.Fatalf("people: %v %d", err, len(docs))
	}
}

func ptr(n int) *int { return &n }
