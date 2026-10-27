package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"testing"
)

// the same cases as test/merge.test.js, so the PC and phone merge alike
func TestMergeCases(t *testing.T) {
	b, err := os.ReadFile("testdata/merge-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name                     string
		Base, Mine, Theirs, Want json.RawMessage
	}
	if err := json.Unmarshal(b, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		base := []byte(c.Base)
		if string(base) == "null" {
			base = nil
		}
		got, err := mergePlanner(base, c.Mine, c.Theirs)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		g, _ := decodeJSON(got)
		w, _ := decodeJSON(c.Want)
		if !sameVal(g, w) {
			t.Errorf("%s:\n got  %s\n want %s", c.Name, got, c.Want)
		}
	}
}

func TestMergeJS(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("no node")
	}
	if out, err := exec.Command("node", "test/merge.test.js").CombinedOutput(); err != nil {
		t.Fatalf("%s", out)
	}
}
