package main

import (
	"testing"
	"time"
)

func TestFindDate(t *testing.T) {
	now := time.Date(2026, 10, 26, 9, 0, 0, 0, time.Local) // a Monday
	cases := map[string]string{
		"The SAC is on Thursday 29 Oct at 9:15am": "2026-10-29",
		"Due by Friday":                            "2026-10-30",
		"Please return the form by 3/11":           "2026-11-03",
		"Excursion on November 12th":               "2026-11-12",
		"Hand in tomorrow":                         "2026-10-27",
		"Camp starts 5 Jan":                        "2027-01-05",
		"Last year's 12 March event":               "2027-03-12",
	}
	for in, want := range cases {
		if got, _ := findDate(in, now); got != want {
			t.Errorf("%q: got %q, want %q", in, got, want)
		}
	}
	if _, ok := findDate("No date in here, version 2.22", now); ok {
		t.Error("found a date where there is none")
	}
	if got := findTime("starts at 9.15am sharp"); got != "09:15" {
		t.Errorf("time: %q", got)
	}
	if got := findTime("6pm Saturday"); got != "18:00" {
		t.Errorf("time: %q", got)
	}
}

func TestMailSortRules(t *testing.T) {
	dataDir = t.TempDir()
	now := time.Date(2026, 10, 26, 9, 0, 0, 0, time.Local)
	mails := []rawMail{
		{ID: "a", Source: "Gmail", From: "Ms Smith <smith@westbourne.vic.edu.au>", Subject: "Re: Physics SAC 2 moved", Body: "The Physics SAC is now on Thursday 29 Oct at 9:15am.\n> old quoted text"},
		{ID: "b", Source: "Gmail", From: "Shop <deals@shop.com>", Subject: "50% off everything", Body: "Big sale", Bulk: true},
		{ID: "c", Source: "Gmail", From: "Mum <mum@gmail.com>", Subject: "Dentist", Body: "Can you sign the form for the dentist by Friday?"},
		{ID: "d", Source: "School Outlook", From: "Year 9 Coordinator", Subject: "Year 9 camp", Body: "To: Students Year 9 Students\nCamp forms due 3/11"},
		{ID: "e", Source: "Gmail", From: "Google <no-reply@accounts.google.com>", Subject: "Security alert", Body: "New sign-in"},
	}
	kept, sum := mailSortRules(mails, now)
	if len(kept) != 2 || kept[0].ID != "a" || kept[1].ID != "c" {
		t.Fatalf("kept: %+v", kept)
	}
	if kept[0].Category != "Changed" || kept[0].Due != "2026-10-29" || kept[0].Time != "09:15" || kept[0].Subject != "Physics SAC 2 moved" || kept[0].Summary != "The Physics SAC is now on Thursday 29 Oct at 9:15am." {
		t.Errorf("SAC: %+v", kept[0])
	}
	if kept[1].Category != "Action needed" || kept[1].Due != "2026-10-30" {
		t.Errorf("Mum: %+v", kept[1])
	}
	if sum != "2 new emails, 1 needs action, 2 with a date." {
		t.Errorf("summary: %q", sum)
	}
}
