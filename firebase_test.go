package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestFsEncodeRoundTrip(t *testing.T) {
	in := `{"a":1,"b":1.5,"c":"x","d":[1,[2,3],{"e":null}],"f":{"g":true}}`
	v, _ := decodeJSON([]byte(in))
	enc, _ := json.Marshal(fsEncode(v, false))
	got, _ := json.Marshal(fsDecode(enc))
	if !sameJSON(got, []byte(in)) {
		t.Fatalf("got %s", got)
	}
}

func TestClampStats(t *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC) // a Wednesday
	s := map[string]any{"week": "2026-11-02", "bogus": 1,
		"study": map[string]any{"mins": 999999.0, "coins": 5000.0, "streak": 3.0},
		"work":  map[string]any{"mins": 60.0, "ovr": 500.0}}
	out := clampStats(nil, s, 0, now)
	if out["bogus"] != nil || getStat(out, "study", "mins") > now.Sub(time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)).Minutes()+1440 || getStat(out, "work", "ovr") != 200 {
		t.Fatalf("new: %v", out)
	}
	if getStat(s, "study", "mins") != 999999 {
		t.Fatal("changed the input")
	}
	old := map[string]any{"week": "2026-11-02", "study": map[string]any{"mins": 100.0, "coins": 1000.0, "streak": 3.0}, "work": map[string]any{"mins": 60.0}}
	out = clampStats(old, s, 12, now)
	// 10 minutes count (2 kept back for clocks): coins +10*10+300, minutes +10+5
	if getStat(out, "study", "coins") != 1400 || getStat(out, "study", "mins") != 115 || getStat(out, "study", "streak") != 3 {
		t.Fatalf("update: %v", out)
	}
	// an old week can't carry minutes
	out = clampStats(nil, map[string]any{"week": "2026-10-01", "study": map[string]any{"mins": 50.0}}, 0, now)
	if out["week"] != nil || getStat(out, "study", "mins") != 0 {
		t.Fatalf("stale: %v", out)
	}
}

func TestCleanNewStats(t *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	s := map[string]any{"week": "2026-11-02",
		"st": map[string]any{"t": 1.0, "s": "Maths Methods and a very long subject name here", "evil": 1.0},
		"ss": map[string]any{"id": "2026-4", "s": 99999.0, "k": -5.0, "tr": 3.0},
		"gr": map[string]any{"m": 1.0, "r": 1.0, "y": 2026.0, "o": 140.0, "s": "Maths=88"},
		"fo": map[string]any{"n": 3.0, "t": "oak:600:4dabf7:0"},
		"cw": "nope"}
	old := map[string]any{"ss": map[string]any{"id": "2026-4", "s": 100.0}}
	out := clampStats(old, s, 10, now)
	st := out["st"].(map[string]any)
	if st["evil"] != nil || len(str(st["s"])) > 30 {
		t.Fatalf("st: %v", st)
	}
	ss := out["ss"].(map[string]any)
	if ss["s"] != 113.0 || ss["k"] != nil {
		t.Fatalf("ss: %v", ss)
	}
	gr := out["gr"].(map[string]any)
	if gr["o"] != 100.0 || gr["s"] != "Maths=88" {
		t.Fatalf("gr: %v", gr)
	}
	if out["fo"].(map[string]any)["t"] != "oak:600:4dabf7:0" || out["cw"] != nil {
		t.Fatalf("fo/cw: %v", out)
	}
}
