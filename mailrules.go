package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// mailSortRules sorts new emails without Claude, for when there's no API key:
// it drops newsletters, marketing and account mail, picks a category from the
// wording, and finds a due date and time in the text when there is one.
func mailSortRules(mails []rawMail, now time.Time) ([]inboxItem, string) {
	year, others := ruleProfile()
	var kept []inboxItem
	act, dated := 0, 0
	for _, m := range mails {
		text := m.Subject + "\n" + m.Body
		low := strings.ToLower(text)
		school := m.Source == "School Outlook" || schoolSender.MatchString(strings.ToLower(m.From))
		if !school && (m.Bulk || robotSender.MatchString(strings.ToLower(m.From)) || junkWords.MatchString(low)) {
			continue
		}
		if school && notForMe(low, year, others) {
			continue
		}
		cat := "FYI"
		switch {
		case changedWords.MatchString(low):
			cat = "Changed"
		case actionWords.MatchString(low):
			cat = "Action needed"
		case dueWords.MatchString(low):
			cat = "Deadline"
		case eventWords.MatchString(low):
			cat = "Event"
		}
		it := inboxItem{ID: m.ID, Category: cat, Source: m.Source, Subject: cleanSubject(m.Subject), Summary: firstLines(m.Body, 220), From: m.From, Received: m.Received, Link: m.Link}
		if cat != "FYI" {
			if d, ok := findDate(text, now); ok {
				it.Due = d
				it.Time = findTime(text)
				dated++
				if cat == "Event" && dueWords.MatchString(low) {
					it.Category = "Deadline"
				}
			}
		}
		if it.Category == "Action needed" {
			act++
		}
		kept = append(kept, it)
	}
	if len(kept) == 0 {
		return nil, ""
	}
	sum := fmt.Sprintf("%d new email%s", len(kept), plural(len(kept)))
	if act > 0 {
		sum += fmt.Sprintf(", %d need%s action", act, map[bool]string{true: "s", false: ""}[act == 1])
	}
	if dated > 0 {
		sum += fmt.Sprintf(", %d with a date", dated)
	}
	return kept, sum + "."
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

var (
	schoolSender = regexp.MustCompile(`\.edu(\.au)?\b|\.vic\.edu\.au|westbourne`)
	robotSender  = regexp.MustCompile(`no-?reply|do-?not-?reply|notifications?@|mailer|marketing|newsletter|news@|promo|deals@|offers@|accounts?@|security@|support@`)
	junkWords    = regexp.MustCompile(`\bunsubscribe\b|% off|\bsale\b|\bdeals?\b|limited time|verify your|security alert|new sign-in|password|your order|has shipped|receipt|invoice|subscription|free trial|discount|coupon`)
	changedWords = regexp.MustCompile(`\b(moved|changed|change of|cancel+ed|rescheduled|postponed|new time|new date|now on|instead)\b`)
	actionWords  = regexp.MustCompile(`\b(please (reply|respond|sign|complete|return|confirm|bring|submit)|permission|consent|sign (and|&) return|payment|pay (by|for)|rsvp|let me know|can you|could you|reply)\b`)
	dueWords     = regexp.MustCompile(`\b(due|deadline|submit|submission|hand in|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the end)|sac|test|exam|assessment|assignment)\b`)
	eventWords   = regexp.MustCompile(`\b(excursion|incursion|camp|assembly|meeting|invite|invitation|event|session|training|game|match|carnival|night|concert|performance)\b`)
	yearRe       = regexp.MustCompile(`\byear (\d{1,2})s?\b|\byr ?(\d{1,2})\b`)
	quotePrefix  = regexp.MustCompile(`(?i)^\s*((re|fw|fwd|aw)\s*:\s*)+`)
)

func ruleProfile() (int, []string) {
	var p struct {
		Settings struct {
			YearLevel any    `json:"yearLevel"`
			Houses    string `json:"houses"`
		} `json:"settings"`
	}
	if b, err := os.ReadFile(filepath.Join(dataDir, dataFileName)); err == nil {
		json.Unmarshal(b, &p)
	}
	year, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(p.Settings.YearLevel)))
	if year == 0 {
		year = 11
	}
	var others []string
	for _, h := range strings.Split(p.Settings.Houses, ",") {
		if h = strings.ToLower(strings.TrimSpace(h)); h != "" {
			others = append(others, h)
		}
	}
	return year, others
}

// notForMe: a school notice that names only other year levels, or only other houses.
func notForMe(low string, year int, others []string) bool {
	head := low
	if len(head) > 600 {
		head = head[:600]
	}
	if ms := yearRe.FindAllStringSubmatch(head, -1); len(ms) > 0 {
		mine := false
		for _, m := range ms {
			n, _ := strconv.Atoi(m[1] + m[2])
			if n == year || (n >= 7 && n <= 12 && strings.Contains(head, "all year")) {
				mine = true
			}
		}
		if !mine {
			return true
		}
	}
	for _, h := range others {
		if regexp.MustCompile(`\b` + regexp.QuoteMeta(h) + `\b`).MatchString(head) {
			return true
		}
	}
	return false
}

func cleanSubject(s string) string {
	s = strings.TrimSpace(quotePrefix.ReplaceAllString(s, ""))
	if s == "" {
		return "(no subject)"
	}
	return s
}

// firstLines is the start of the email, without quoted replies or signatures.
func firstLines(body string, n int) string {
	var out []string
	for _, l := range strings.Split(body, "\n") {
		l = strings.TrimSpace(l)
		if strings.HasPrefix(l, ">") || l == "--" || strings.HasPrefix(strings.ToLower(l), "on ") && strings.HasSuffix(l, "wrote:") {
			if l == "--" || strings.HasSuffix(l, "wrote:") {
				break
			}
			continue
		}
		if l != "" {
			out = append(out, l)
		}
	}
	s := strings.Join(out, " ")
	if r := []rune(s); len(r) > n {
		s = strings.TrimSpace(string(r[:n])) + "…"
	}
	return s
}

var (
	months   = map[string]time.Month{"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
	weekdays = map[string]time.Weekday{"sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "saturday": 6}
	dayMonRe = regexp.MustCompile(`(?i)\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b`)
	monDayRe = regexp.MustCompile(`(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b`)
	slashRe  = regexp.MustCompile(`\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b`)
	relRe    = regexp.MustCompile(`(?i)\b(today|tonight|tomorrow|(?:this |next |on |by )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b`)
	timeRe   = regexp.MustCompile(`(?i)\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b`)
)

// findDate returns the first date in the text from today up to 6 months ahead,
// as YYYY-MM-DD. Australian order is used for 3/11 (3 November).
func findDate(text string, now time.Time) (string, bool) {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	type hit struct {
		at int
		d  time.Time
	}
	var best *hit
	try := func(at int, d time.Time) {
		if d.Before(today) {
			d = d.AddDate(1, 0, 0) // "3 Jan" read in December is next year
		}
		if d.Before(today) || d.After(today.AddDate(0, 6, 0)) {
			return
		}
		if best == nil || at < best.at {
			best = &hit{at, d}
		}
	}
	mk := func(day int, mon time.Month, yr int) (time.Time, bool) {
		if yr == 0 {
			yr = today.Year()
		} else if yr < 100 {
			yr += 2000
		}
		d := time.Date(yr, mon, day, 0, 0, 0, 0, now.Location())
		return d, day >= 1 && d.Day() == day
	}
	for _, m := range dayMonRe.FindAllStringSubmatchIndex(text, -1) {
		day, _ := strconv.Atoi(text[m[2]:m[3]])
		if d, ok := mk(day, months[strings.ToLower(text[m[4]:m[5]])], 0); ok {
			try(m[0], d)
		}
	}
	for _, m := range monDayRe.FindAllStringSubmatchIndex(text, -1) {
		day, _ := strconv.Atoi(text[m[4]:m[5]])
		if d, ok := mk(day, months[strings.ToLower(text[m[2]:m[3]])], 0); ok {
			try(m[0], d)
		}
	}
	for _, m := range slashRe.FindAllStringSubmatchIndex(text, -1) {
		day, _ := strconv.Atoi(text[m[2]:m[3]])
		mon, _ := strconv.Atoi(text[m[4]:m[5]])
		yr := 0
		if m[6] >= 0 {
			yr, _ = strconv.Atoi(text[m[6]:m[7]])
		}
		if mon >= 1 && mon <= 12 {
			if d, ok := mk(day, time.Month(mon), yr); ok {
				try(m[0], d)
			}
		}
	}
	for _, m := range relRe.FindAllStringSubmatchIndex(text, -1) {
		w := strings.ToLower(text[m[2]:m[3]])
		switch {
		case w == "today" || w == "tonight":
			try(m[0], today)
		case w == "tomorrow":
			try(m[0], today.AddDate(0, 0, 1))
		default:
			wd := weekdays[strings.ToLower(text[m[4]:m[5]])]
			n := (int(wd) - int(today.Weekday()) + 7) % 7
			if n == 0 || strings.HasPrefix(w, "next ") {
				n += 7
			}
			if strings.HasPrefix(w, "next ") && n > 7 && (int(wd)-int(today.Weekday())+7)%7 != 0 {
				n -= 7 // "next Thursday" on a Monday is this coming Thursday
			}
			try(m[0], today.AddDate(0, 0, n))
		}
	}
	if best == nil {
		return "", false
	}
	return best.d.Format("2006-01-02"), true
}

func findTime(text string) string {
	m := timeRe.FindStringSubmatch(text)
	if m == nil {
		return ""
	}
	h, _ := strconv.Atoi(m[1])
	if h < 1 || h > 12 {
		return ""
	}
	if strings.EqualFold(m[3], "pm") && h != 12 {
		h += 12
	} else if strings.EqualFold(m[3], "am") && h == 12 {
		h = 0
	}
	mm := "00"
	if m[2] != "" {
		mm = m[2]
	}
	return fmt.Sprintf("%02d:%s", h, mm)
}
