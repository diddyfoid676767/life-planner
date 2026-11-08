package main

import (
	"fmt"
	"testing"
	"time"
)

// 2.50 house islands: only house members write, and only their own share and votes.
func TestEmuHouse(t *testing.T) {
	emu(t)
	sfx := fmt.Sprint(time.Now().UnixNano() % 100000)
	ann, bob, cat := mustUser(t, "hann"+sfx), mustUser(t, "hbob"+sfx), mustUser(t, "hcat"+sfx)
	now := time.Now()
	wk := now.AddDate(0, 0, -((int(now.Weekday())+6)%7)).Format("2006-01-02")
	time.Sleep(22 * time.Second)
	for _, a := range []*account{ann, bob} {
		if _, err := publishProfile(a, "x", `{}`, map[string]any{"week": wk, "hs": map[string]any{"h": "pascoe", "wk": wk, "d": 1.0}}, time.Now()); err != nil {
			t.Fatalf("publish: %v", err)
		}
	}
	doc := map[string]any{"c": map[string]any{ann.UserID: map[string]any{"n": "ann", "l": 50.0, "e": 10.0}}}
	ts, err := fsCommit(ann.Access, fsSet("houses/pascoe", doc, false, "new", "at"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = fsCommit(cat.Access, fsSet("houses/pascoe", map[string]any{"c": map[string]any{ann.UserID: map[string]any{"n": "ann", "l": 50.0, "e": 10.0}, cat.UserID: map[string]any{"n": "cat", "l": 1.0}}}, false, "", "at"))
	denied(t, "not in the house", err)
	_, err = fsCommit(bob.Access, fsSet("houses/pascoe", map[string]any{"c": map[string]any{ann.UserID: map[string]any{"n": "ann", "l": 0.0, "e": 0.0}}}, false, "", "at"))
	denied(t, "changing someone else's share", err)
	_, err = fsCommit(ann.Access, fsSet("houses/pascoe", map[string]any{"c": map[string]any{ann.UserID: map[string]any{"n": "ann", "l": 5.0, "e": 10.0}}}, false, "", "at"))
	denied(t, "lowering your own share", err)
	_, err = fsCommit(bob.Access, fsSet("houses/pascoe", map[string]any{"c": doc["c"], "sp": map[string]any{"l": 40.0}, "b": map[string]any{"banner": map[string]any{"s": "2026-11-08", "r": "2026-11-15", "reps": []any{}}},
		"v": map[string]any{bob.UserID: map[string]any{"t": "2026-T4", "ld": "ann"}}}, false, ts[0], "at"))
	if err != nil {
		t.Fatalf("member update: %v", err)
	}
	_, err = fsCommit(bob.Access, fsSet("houses/pascoe", map[string]any{"c": doc["c"], "sp": map[string]any{"l": 40.0}}, false, ts[0], "at"))
	if fbStatus(err) != "FAILED_PRECONDITION" {
		t.Fatalf("stale write should fail precondition: %v", err)
	}
	d, _ := fsGet(bob.Access, "houses/pascoe")
	_, err = fsCommit(bob.Access, fsSet("houses/pascoe", map[string]any{"c": doc["c"], "sp": map[string]any{"l": 10.0}}, false, d.Updated, "at"))
	denied(t, "spend going down", err)
}
