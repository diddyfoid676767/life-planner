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
