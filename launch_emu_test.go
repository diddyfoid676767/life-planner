package main

// 2.67 launch: email accounts, the year list, verification, owner tools and
// the launch switch, against the emulators with the real firestore.rules (see
// firebase_emu_test.go for how to run it).

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// emuVerify opens the newest "verify your email" link the auth emulator kept for email.
func emuVerify(t *testing.T, email string) {
	t.Helper()
	res, err := http.Get("http://127.0.0.1:9099/emulator/v1/projects/demo-lp/oobCodes")
	if err != nil {
		t.Fatal(err)
	}
	var r struct {
		OobCodes []struct{ Email, OobLink, RequestType string } `json:"oobCodes"`
	}
	json.NewDecoder(res.Body).Decode(&r)
	res.Body.Close()
	link := ""
	for _, c := range r.OobCodes {
		if strings.EqualFold(c.Email, email) && c.RequestType == "VERIFY_EMAIL" {
			link = c.OobLink
		}
	}
	if link == "" {
		t.Fatalf("no verify link for %s", email)
	}
	if res, err := http.Get(link); err != nil {
		t.Fatal(err)
	} else {
		res.Body.Close()
	}
}

// check runs the sign-in check again (2.67.4: no emailed link)
func check(t *testing.T, a *account) *account {
	t.Helper()
	n, err := forceRefresh(a)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := finishVerify(n); err != nil {
		t.Fatalf("finishVerify: %v", err)
	}
	return n
}

func TestEmuLaunch(t *testing.T) {
	emu(t)
	sfx := fmt.Sprint(time.Now().UnixNano() % 1000000)
	// the owner's real address (kept out of the repository): LP_TEST_OWNER=...
	owner := os.Getenv("LP_TEST_OWNER")
	if owner == "" {
		t.Skip("set LP_TEST_OWNER to the owner's school email")
	}
	if !isOwnerEmail(owner) {
		t.Fatal("owner hash")
	}
	// a fresh emulator per run: the owner account can only be made once
	o, err := emailSignUp(owner, "password123", "Eli", "")
	if err != nil {
		t.Fatalf("owner signup: %v", err)
	}
	stu := "jd" + sfx + "@" + schoolDomain
	out := "someone" + sfx + "@gmail.com"
	notOnList := "zz" + sfx + "@" + schoolDomain

	o = check(t, o)
	if o.School {
		t.Fatal("owner counted as school before the list is loaded")
	}
	ws := []fsWrite{
		fsSet("yr/"+yrHash(owner), map[string]any{"n": sealName(owner, "Eli S"), "b": false}, false, ""),
		fsSet("yr/"+yrHash(stu), map[string]any{"n": sealName(stu, "Jules Deglas"), "b": true}, false, ""),
	}
	if _, err := fsCommit(o.Access, ws...); err != nil {
		t.Fatalf("owner loads the list: %v", err)
	}
	o = check(t, o)
	if !o.School {
		t.Fatal("owner not school after the list")
	}
	if p, _ := fsGet("", "profiles/"+o.UserID); fmt.Sprint(p.Fields["badges"]) != "[dev]" || p.Fields["display"] != "Eli S" {
		t.Fatalf("owner profile: %v", p.Fields)
	}
	if c, _ := fsGet("", "config/owner"); c == nil || c.Fields["uid"] != o.UserID {
		t.Fatal("config/owner")
	}

	// a student on the list, invited by the owner
	s, err := emailSignUp(stu, "password123", "J", o.UserID)
	if err != nil {
		t.Fatal(err)
	}
	// can't read someone else's entry
	if _, err := fsGet(s.Access, "yr/"+yrHash(owner)); err == nil {
		t.Fatal("read someone else's entry")
	}
	// can't give themselves the dev badge
	if _, err := fsCommit(s.Access, fsSet("profiles/"+s.UserID, map[string]any{"badges": []string{"dev", "beta"}}, true, "old")); err == nil {
		t.Fatal("self-dev")
	}
	// the address is taken now: nobody else can sign up with it
	if _, err := emailSignUp(strings.ToUpper(stu), "password456", "Imp", ""); err == nil {
		t.Fatal("second account with the same address")
	}
	s = check(t, s)
	p, _ := fsGet("", "profiles/"+s.UserID)
	if !s.School || p.Fields["v"] != true || fmt.Sprint(p.Fields["badges"]) != "[beta]" || p.Fields["display"] != "Jules Deglas" || p.Fields["inv"] != o.UserID || p.Fields["ic"] != icOf(s.UserID) {
		t.Fatalf("student profile: %v", p.Fields)
	}
	// publishing keeps the real name, and can join a house
	now := time.Now()
	wk := now.AddDate(0, 0, -((int(now.Weekday())+6)%7)).Format("2006-01-02")
	time.Sleep(21 * time.Second)
	firstDone = true
	if _, err := publishProfile(s, "Nickname", `{}`, map[string]any{"week": wk, "hs": map[string]any{"h": "pascoe", "wk": wk, "d": 1.0}}, time.Now()); err != nil {
		t.Fatalf("student publish: %v", err)
	}
	firstDone = false
	if p, _ := fsGet("", "profiles/"+s.UserID); p.Fields["display"] != "Jules Deglas" || p.Fields["fs"] != true {
		t.Fatalf("after publish: %v", p.Fields)
	}

	// someone outside the school: fine for the planner, no house
	x, err := emailSignUp(out, "password123", "Pat", "")
	if err != nil {
		t.Fatal(err)
	}
	x = check(t, x)
	if x.School {
		t.Fatal("outsider counted as school")
	}
	// an outside address can't mark itself verified or read the list
	if _, err := fsCommit(x.Access, fsSet("profiles/"+x.UserID, map[string]any{"v": true, "eh": ehOf(out)}, true, "old")); err == nil {
		t.Fatal("outsider self-verified")
	}
	if _, err := publishProfile(x, "Pat", `{}`, map[string]any{"week": wk, "hs": map[string]any{"h": "pascoe", "wk": wk}}, time.Now()); err == nil {
		// publishProfile drops hs and retries when the rules refuse it, so check what was stored
		if p, _ := fsGet("", "profiles/"+x.UserID); p != nil {
			if st, _ := p.Fields["stats"].(map[string]any); st["hs"] != nil {
				t.Fatal("outsider joined a house")
			}
		}
	}
	// a school address not on the list
	n, err := emailSignUp(notOnList, "password123", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if n = check(t, n); n.School {
		t.Fatal("not on the list but counted")
	}

	// friends by school email and by name
	if d, err := fsQuery("", "", map[string]any{"from": []map[string]string{{"collectionId": "profiles"}}, "where": fsWhere("eh", "EQUAL", ehOf(strings.ToUpper(stu)))}); err != nil || len(d) != 1 {
		t.Fatalf("by email: %v %d", err, len(d))
	}
	if d, err := fsQuery("", "", map[string]any{"from": []map[string]string{{"collectionId": "profiles"}}, "where": fsAnd(fsWhere("dl", "GREATER_THAN_OR_EQUAL", "jules"), fsWhere("dl", "LESS_THAN", "jules"))}); err != nil || len(d) != 1 {
		t.Fatalf("by name: %v %d", err, len(d))
	}

	// owner sets badges by hand; nobody else can
	if _, err := fsCommit(x.Access, fsSet("profiles/"+n.UserID, map[string]any{"badges": []string{"beta"}}, true, "old")); err == nil {
		t.Fatal("non-owner set badges")
	}
	if _, err := fsCommit(o.Access, fsSet("profiles/"+n.UserID, map[string]any{"badges": []string{"beta"}}, true, "old")); err != nil {
		t.Fatalf("owner badges: %v", err)
	}

	// old username accounts work until launch, then stop
	old := mustUser(t, "old"+sfx)
	time.Sleep(21 * time.Second)
	if _, err := publishProfile(old, "Old", `{}`, map[string]any{"week": wk, "hs": map[string]any{"h": "pascoe", "wk": wk}}, time.Now()); err != nil {
		t.Fatalf("legacy before launch: %v", err)
	}
	if _, err := fsCommit(x.Access, fsSet("config/launch", map[string]any{"reset": true, "at": "x"}, false, "")); err == nil {
		t.Fatal("non-owner launched")
	}
	if _, err := fsCommit(o.Access, fsSet("config/launch", map[string]any{"reset": true, "at": "2027-02-01"}, false, "")); err != nil {
		t.Fatalf("launch: %v", err)
	}
	time.Sleep(21 * time.Second)
	if _, err := publishProfile(old, "Old", `{}`, map[string]any{"week": wk}, time.Now()); err == nil {
		t.Fatal("legacy account still publishes after launch")
	}
	if _, err := signUp("new"+sfx, "password123"); err == nil {
		t.Fatal("new username account after launch")
	}
	// email accounts carry on
	if _, err := emailSignUp("late"+sfx+"@gmail.com", "password123", "Late", ""); err != nil {
		t.Fatalf("email signup after launch: %v", err)
	}
	fsCommit(o.Access, fsSet("config/launch", map[string]any{"reset": false, "at": ""}, false, ""))
}
