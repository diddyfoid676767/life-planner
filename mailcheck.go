package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// The direct email check: while the planner is open it reads Gmail itself over
// IMAP (with a Google app password), plus the school Outlook export in the data
// folder, and asks Claude (with the user's own API key) which emails matter.
// New items are merged into data/missed-info.json, the same file the hourly
// Claude task writes, so it works even when that task can't reach this PC.
type mailConf struct {
	User string `json:"user"`
	Pass string `json:"pass"`
}

type mailState struct {
	Checked string `json:"checked"`
	Error   string `json:"error,omitempty"`
	Added   int    `json:"added"`
}

var (
	mailMu      sync.Mutex // one check at a time
	mailStateMu sync.Mutex
	mailLast    mailState
	mailLastRun time.Time
)

func mailConfPath() string  { return filepath.Join(dataDir, "mail-direct.json") }
func mailStatePath() string { return filepath.Join(dataDir, "mail-direct-state.json") }

func loadMailConf() mailConf {
	var c mailConf
	if b, err := os.ReadFile(mailConfPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	return c
}

func getMailState() mailState {
	mailStateMu.Lock()
	defer mailStateMu.Unlock()
	if mailLast.Checked == "" {
		if b, err := os.ReadFile(mailStatePath()); err == nil {
			json.Unmarshal(b, &mailLast)
		}
	}
	return mailLast
}

func setMailState(s mailState) {
	mailStateMu.Lock()
	mailLast = s
	mailStateMu.Unlock()
	b, _ := json.Marshal(s)
	os.WriteFile(mailStatePath(), b, 0o644)
}

func handleMail(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	c := loadMailConf()
	status := func() map[string]any {
		st := getMailState()
		return map[string]any{"configured": c.User != "" && c.Pass != "", "user": c.User, "ai": loadAI().Key != "", "checked": st.Checked, "error": st.Error, "added": st.Added}
	}
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(status())
	case http.MethodPut:
		var in struct{ User, Pass string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		in.User = strings.TrimSpace(in.User)
		in.Pass = strings.ReplaceAll(strings.TrimSpace(in.Pass), " ", "") // Google shows app passwords in groups of four
		if in.User == "" {
			os.Remove(mailConfPath())
			c = mailConf{}
			json.NewEncoder(w).Encode(status())
			return
		}
		if !strings.Contains(in.User, "@") {
			writeErr(w, http.StatusBadRequest, "Type your full Gmail address.")
			return
		}
		if in.Pass == "" && in.User == c.User {
			in.Pass = c.Pass
		}
		if len(in.Pass) < 8 {
			writeErr(w, http.StatusBadRequest, "Paste the 16-letter app password from Google.")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		if err := imapTest(ctx, mailConf{in.User, in.Pass}); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		c = mailConf{in.User, in.Pass}
		os.MkdirAll(dataDir, 0o755)
		b, _ := json.Marshal(c)
		if err := os.WriteFile(mailConfPath(), b, 0o600); err != nil {
			writeErr(w, http.StatusInternalServerError, "Couldn't save it.")
			return
		}
		json.NewEncoder(w).Encode(status())
	case http.MethodPost:
		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Minute)
		defer cancel()
		added, err := runMailCheck(ctx)
		if err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		out := status()
		out["ok"], out["added"] = true, added
		json.NewEncoder(w).Encode(out)
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

// mailLoop checks every 30 minutes from 7am to 10pm while the planner runs.
func mailLoop() {
	time.Sleep(20 * time.Second)
	for {
		h := time.Now().Hour()
		c := loadMailConf()
		st := getMailState()
		last, _ := time.Parse(time.RFC3339, st.Checked)
		if h >= 7 && h < 22 && (c.User != "" || fileExists(filepath.Join(dataDir, "school-mail.json"))) && loadAI().Key != "" && time.Since(last) > 30*time.Minute {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
			runMailCheck(ctx)
			cancel()
		}
		time.Sleep(5 * time.Minute)
	}
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }

type rawMail struct {
	ID, Source, From, Subject, Received, Link, Body string
}

type inboxItem struct {
	ID       string `json:"id"`
	Category string `json:"category"`
	Source   string `json:"source"`
	Subject  string `json:"subject"`
	Summary  string `json:"summary"`
	From     string `json:"from"`
	Received string `json:"received"`
	Due      string `json:"due"`
	Time     string `json:"time,omitempty"`
	Link     string `json:"link"`
}

func runMailCheck(ctx context.Context) (int, error) {
	if !mailMu.TryLock() {
		return 0, errors.New("A check is already running.")
	}
	defer mailMu.Unlock()
	if time.Since(mailLastRun) < 20*time.Second {
		return 0, nil
	}
	mailLastRun = time.Now()
	added, err := mailCheck(ctx)
	st := mailState{Checked: time.Now().Format(time.RFC3339), Added: added}
	if err != nil {
		st.Error = err.Error()
		if prev := getMailState(); prev.Checked != "" {
			st.Checked = prev.Checked // keep the time of the last check that worked
		}
	}
	setMailState(st)
	return added, err
}

func mailCheck(ctx context.Context) (int, error) {
	ai := loadAI()
	if ai.Key == "" {
		return 0, errors.New("Add your Claude API key in Settings, App, so Claude can sort your email.")
	}
	infoPath := filepath.Join(dataDir, "missed-info.json")
	info := map[string]any{}
	if b, err := os.ReadFile(infoPath); err == nil {
		json.Unmarshal(b, &info)
	}
	var items []inboxItem
	if b, err := json.Marshal(info["items"]); err == nil {
		json.Unmarshal(b, &items)
	}
	known := map[string]bool{}
	for _, it := range items {
		known[it.ID] = true
	}
	seen := mailSeen()
	for k := range seen.ids {
		known[k] = true
	}
	// Emails already looked at by a direct check (kept or not) aren't sent to Claude again.
	looked := loadLooked()
	for k := range looked {
		known[k] = true
	}

	var fresh []rawMail
	var errs []string
	if c := loadMailConf(); c.User != "" {
		got, err := imapFetch(ctx, c, time.Now().AddDate(0, 0, -3))
		if err != nil {
			errs = append(errs, err.Error())
		}
		fresh = append(fresh, got...)
	}
	fresh = append(fresh, schoolMail()...)
	var todo []rawMail
	for _, m := range fresh {
		if !known[m.ID] && !seen.subjects[normSubject(m.Subject)] {
			todo = append(todo, m)
		}
	}
	if len(todo) > 40 {
		sort.Slice(todo, func(i, j int) bool { return todo[i].Received > todo[j].Received })
		todo = todo[:40]
	}
	n := 0
	if len(todo) > 0 {
		kept, summary, err := mailSort(ctx, ai, todo)
		if err != nil {
			return 0, errors.New(aiErrText(err))
		}
		for _, m := range todo {
			looked[m.ID] = time.Now().Format("2006-01-02")
		}
		saveLooked(looked)
		// Re-read: the hourly Claude task may have written the file meanwhile.
		info = map[string]any{}
		items = nil
		if b, err := os.ReadFile(infoPath); err == nil {
			json.Unmarshal(b, &info)
		}
		if b, err := json.Marshal(info["items"]); err == nil {
			json.Unmarshal(b, &items)
		}
		have := map[string]bool{}
		for _, it := range items {
			have[it.ID] = true
		}
		for _, it := range kept {
			if !have[it.ID] {
				items = append(items, it)
				n++
			}
		}
		if n > 0 {
			cut := time.Now().AddDate(0, 0, -21).Format("2006-01-02")
			out := items[:0]
			for _, it := range items {
				if it.Received == "" || it.Received[:min(10, len(it.Received))] >= cut || (it.Due != "" && it.Due >= time.Now().Format("2006-01-02")) {
					out = append(out, it)
				}
			}
			info["items"] = out
			info["updated"] = time.Now().Format(time.RFC3339)
			if summary != "" {
				info["summary"] = summary
			}
			b, _ := json.MarshalIndent(info, "", "  ")
			tmp := infoPath + ".tmp"
			if err := os.WriteFile(tmp, b, 0o644); err != nil {
				return 0, err
			}
			if err := os.Rename(tmp, infoPath); err != nil {
				return 0, err
			}
		}
	}
	if len(errs) > 0 {
		return n, errors.New(strings.Join(errs, " "))
	}
	return n, nil
}

type seenSet struct {
	ids      map[string]bool
	subjects map[string]bool
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)
var rePrefix = regexp.MustCompile(`^\s*((re|fw|fwd|aw)\s*:\s*)+`)

func normSubject(s string) string {
	s = rePrefix.ReplaceAllString(strings.ToLower(s), "")
	return strings.TrimSpace(nonAlnum.ReplaceAllString(s, " "))
}

// mailSeen collects what the user crossed off, from missed-dismissed.json and the planner data.
func mailSeen() seenSet {
	s := seenSet{map[string]bool{}, map[string]bool{}}
	var d struct {
		IDs      []string `json:"ids"`
		Subjects []string `json:"subjects"`
	}
	if b, err := os.ReadFile(filepath.Join(dataDir, "missed-dismissed.json")); err == nil && json.Unmarshal(b, &d) == nil {
		for _, id := range d.IDs {
			s.ids[id] = true
		}
		for _, k := range d.Subjects {
			s.subjects[k] = true
		}
	}
	var p struct {
		InboxSeen  map[string]string `json:"inboxSeen"`
		InboxMuted map[string]string `json:"inboxMuted"`
	}
	if b, err := os.ReadFile(filepath.Join(dataDir, dataFileName)); err == nil && json.Unmarshal(b, &p) == nil {
		for id, v := range p.InboxSeen {
			if v == "dismissed" {
				s.ids[id] = true
			}
		}
		for k := range p.InboxMuted {
			s.subjects[k] = true
		}
	}
	return s
}

func lookedPath() string { return filepath.Join(dataDir, "mail-direct-seen.json") }

func loadLooked() map[string]string {
	m := map[string]string{}
	if b, err := os.ReadFile(lookedPath()); err == nil {
		json.Unmarshal(b, &m)
	}
	cut := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	for k, v := range m {
		if v < cut {
			delete(m, k)
		}
	}
	return m
}

func saveLooked(m map[string]string) {
	b, _ := json.Marshal(m)
	os.WriteFile(lookedPath(), b, 0o644)
}

// schoolMail reads the school Outlook export ({items:[{entryId, received, from, subject, preview, to}]}).
func schoolMail() []rawMail {
	var f struct {
		Items []struct {
			EntryID  string `json:"entryId"`
			Received string `json:"received"`
			From     string `json:"from"`
			To       string `json:"to"`
			Subject  string `json:"subject"`
			Preview  string `json:"preview"`
		} `json:"items"`
	}
	b, err := os.ReadFile(filepath.Join(dataDir, "school-mail.json"))
	if err != nil || json.Unmarshal(b, &f) != nil {
		return nil
	}
	cut := time.Now().AddDate(0, 0, -3)
	var out []rawMail
	for _, it := range f.Items {
		if it.EntryID == "" {
			continue
		}
		if t, err := parseAnyTime(it.Received); err == nil && t.Before(cut) {
			continue
		}
		out = append(out, rawMail{ID: it.EntryID, Source: "School Outlook", From: it.From, Subject: it.Subject, Received: it.Received, Body: "To: " + it.To + "\n" + it.Preview})
	}
	return out
}

func parseAnyTime(s string) (time.Time, error) {
	for _, l := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02T15:04"} {
		if t, err := time.ParseInLocation(l, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errors.New("time")
}

func plannerProfile() string {
	var p struct {
		Settings struct {
			Name      string `json:"name"`
			YearLevel any    `json:"yearLevel"`
			House     string `json:"house"`
			Houses    string `json:"houses"`
		} `json:"settings"`
		Subjects []struct {
			Name string `json:"name"`
		} `json:"subjects"`
	}
	if b, err := os.ReadFile(filepath.Join(dataDir, dataFileName)); err == nil {
		json.Unmarshal(b, &p)
	}
	yl := fmt.Sprint(p.Settings.YearLevel)
	if yl == "" || yl == "<nil>" {
		yl = "11"
	}
	var subs []string
	for _, s := range p.Subjects {
		subs = append(subs, s.Name)
	}
	out := fmt.Sprintf("The student is %s, in Year %s", strings.TrimSpace(p.Settings.Name), yl)
	if p.Settings.House != "" {
		out += ", " + p.Settings.House + " house"
	}
	out += ", at a school in Melbourne, Australia."
	if p.Settings.Houses != "" {
		out += " Other houses (skip notices only for them): " + p.Settings.Houses + "."
	}
	if len(subs) > 0 {
		out += " Subjects: " + strings.Join(subs, ", ") + "."
	}
	return out
}

const mailSortSystem = `You sort a student's new emails for the "Missed info" page of their planner. Keep anything they need to know or act on: school notices, teacher and parent emails, SACs, tests, assignments, forms, payments, excursions, timetable or room changes, sport and club news that affects them, and personal messages. Drop marketing, newsletters with nothing actionable, social media, account and security notifications, receipts, and notices aimed at other year levels or houses.
For each email return keep, and when keeping it: a category (Action needed, Deadline, Event, Changed or FYI), a clean subject written as a to-do that names the school subject when there is one (for example "Physics SAC 2: Motion"), a one or two sentence summary, the due date as YYYY-MM-DD in Melbourne time when there is something to do or attend by a date (otherwise ""), and the time as HH:MM when one is given (otherwise "").
Also write a one-sentence overall summary of what is new, or "" if you keep nothing.`

func mailSort(ctx context.Context, ai aiConf, mails []rawMail) ([]inboxItem, string, error) {
	var sb strings.Builder
	sb.WriteString(plannerProfile())
	sb.WriteString("\nToday is " + time.Now().Format("Monday 2 January 2006") + ".\n\n")
	for i, m := range mails {
		body := m.Body
		if len(body) > 3000 {
			body = body[:3000] + "…"
		}
		fmt.Fprintf(&sb, "<email n=\"%d\">\nFrom: %s\nReceived: %s\nSubject: %s\n\n%s\n</email>\n\n", i, m.From, m.Received, m.Subject, body)
	}
	schema := map[string]any{
		"type": "object", "additionalProperties": false, "required": []string{"summary", "emails"},
		"properties": map[string]any{
			"summary": map[string]any{"type": "string"},
			"emails": map[string]any{"type": "array", "items": map[string]any{
				"type": "object", "additionalProperties": false,
				"required": []string{"n", "keep", "category", "subject", "summary", "due", "time"},
				"properties": map[string]any{
					"n":        map[string]any{"type": "integer"},
					"keep":     map[string]any{"type": "boolean"},
					"category": map[string]any{"type": "string", "enum": []string{"Action needed", "Deadline", "Event", "Changed", "FYI"}},
					"subject":  map[string]any{"type": "string"},
					"summary":  map[string]any{"type": "string"},
					"due":      map[string]any{"type": "string"},
					"time":     map[string]any{"type": "string"},
				},
			}},
		},
	}
	var out struct {
		Summary string `json:"summary"`
		Emails  []struct {
			N                                     int
			Keep                                  bool
			Category, Subject, Summary, Due, Time string
		} `json:"emails"`
	}
	if err := aiJSON(ctx, ai, mailSortSystem, sb.String(), schema, &out); err != nil {
		return nil, "", err
	}
	dateRe := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	timeRe := regexp.MustCompile(`^\d{2}:\d{2}$`)
	var kept []inboxItem
	done := map[int]bool{}
	for _, e := range out.Emails {
		if !e.Keep || e.N < 0 || e.N >= len(mails) || done[e.N] {
			continue
		}
		done[e.N] = true
		m := mails[e.N]
		it := inboxItem{ID: m.ID, Category: e.Category, Source: m.Source, Subject: strings.TrimSpace(e.Subject), Summary: strings.TrimSpace(e.Summary), From: m.From, Received: m.Received, Link: m.Link}
		if it.Subject == "" {
			it.Subject = m.Subject
		}
		if dateRe.MatchString(e.Due) {
			it.Due = e.Due
		}
		if timeRe.MatchString(e.Time) {
			it.Time = e.Time
		}
		kept = append(kept, it)
	}
	return kept, strings.TrimSpace(out.Summary), nil
}

// ---------- a small IMAP client, just enough to read recent Gmail ----------

type imapConn struct {
	c   net.Conn
	r   *bufio.Reader
	tag int
}

// imapResp is one untagged or tagged response, with any literals it carried.
type imapResp struct {
	text string   // the response with each literal replaced by \x00
	lits [][]byte // the literals, in order
}

// imapAddr and imapTLS can be swapped in tests.
var (
	imapAddr = "imap.gmail.com:993"
	imapTLS  = func() *tls.Config { return &tls.Config{ServerName: strings.Split(imapAddr, ":")[0]} }
)

func imapDial(ctx context.Context, c mailConf) (*imapConn, error) {
	d := &tls.Dialer{NetDialer: &net.Dialer{Timeout: 15 * time.Second}, Config: imapTLS()}
	nc, err := d.DialContext(ctx, "tcp", imapAddr)
	if err != nil {
		return nil, errors.New("Couldn't reach Gmail. Check your internet connection.")
	}
	if dl, ok := ctx.Deadline(); ok {
		nc.SetDeadline(dl)
	}
	ic := &imapConn{c: nc, r: bufio.NewReaderSize(nc, 64<<10)}
	if _, err := ic.read(); err != nil { // greeting
		nc.Close()
		return nil, errors.New("Gmail didn't answer.")
	}
	if _, st, err := ic.cmd("LOGIN " + imapQuote(c.User) + " " + imapQuote(c.Pass)); err != nil || !strings.HasPrefix(st, "OK") {
		nc.Close()
		return nil, errors.New("Gmail didn't accept the address and app password. Make a new app password and paste it in Settings, App.")
	}
	return ic, nil
}

func imapQuote(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
}

var litRe = regexp.MustCompile(`\{(\d+)\}$`)

func (ic *imapConn) read() (imapResp, error) {
	var resp imapResp
	var sb strings.Builder
	for {
		line, err := ic.r.ReadString('\n')
		if err != nil {
			return resp, err
		}
		line = strings.TrimRight(line, "\r\n")
		if m := litRe.FindStringSubmatch(line); m != nil {
			n, _ := strconv.Atoi(m[1])
			if n > 50<<20 {
				return resp, errors.New("literal too large")
			}
			buf := make([]byte, n)
			if _, err := io.ReadFull(ic.r, buf); err != nil {
				return resp, err
			}
			sb.WriteString(line[:len(line)-len(m[0])])
			sb.WriteByte(0)
			resp.lits = append(resp.lits, buf)
			continue
		}
		sb.WriteString(line)
		resp.text = sb.String()
		return resp, nil
	}
}

// cmd sends a command and returns the untagged responses and the tagged status ("OK ...").
func (ic *imapConn) cmd(c string) ([]imapResp, string, error) {
	ic.tag++
	tag := "a" + strconv.Itoa(ic.tag)
	if _, err := ic.c.Write([]byte(tag + " " + c + "\r\n")); err != nil {
		return nil, "", err
	}
	var out []imapResp
	for {
		r, err := ic.read()
		if err != nil {
			return out, "", err
		}
		if strings.HasPrefix(r.text, tag+" ") {
			return out, r.text[len(tag)+1:], nil
		}
		out = append(out, r)
	}
}

func imapTest(ctx context.Context, c mailConf) error {
	ic, err := imapDial(ctx, c)
	if err != nil {
		return err
	}
	ic.cmd("LOGOUT")
	ic.c.Close()
	return nil
}

var gmIDRe = regexp.MustCompile(`X-GM-MSGID (\d+)`)

func imapFetch(ctx context.Context, c mailConf, since time.Time) ([]rawMail, error) {
	ic, err := imapDial(ctx, c)
	if err != nil {
		return nil, err
	}
	defer ic.c.Close()
	defer ic.cmd("LOGOUT")
	if _, st, err := ic.cmd(`EXAMINE "INBOX"`); err != nil || !strings.HasPrefix(st, "OK") {
		return nil, errors.New("Couldn't open your Gmail inbox.")
	}
	// Skip Promotions and Social straight away with Gmail's own search.
	rs, st, err := ic.cmd(`UID SEARCH X-GM-RAW ` + imapQuote("after:"+since.Format("2006/01/02")+" -category:promotions -category:social -category:forums"))
	if err != nil || !strings.HasPrefix(st, "OK") {
		rs, st, err = ic.cmd("UID SEARCH SINCE " + since.Format("2-Jan-2006"))
		if err != nil || !strings.HasPrefix(st, "OK") {
			return nil, errors.New("Couldn't search your Gmail.")
		}
	}
	var uids []string
	for _, r := range rs {
		if strings.HasPrefix(r.text, "* SEARCH") {
			uids = append(uids, strings.Fields(r.text[8:])...)
		}
	}
	if len(uids) == 0 {
		return nil, nil
	}
	if len(uids) > 60 {
		uids = uids[len(uids)-60:]
	}
	rs, st, err = ic.cmd("UID FETCH " + strings.Join(uids, ",") + " (X-GM-MSGID BODY.PEEK[]<0.120000>)")
	if err != nil || !strings.HasPrefix(st, "OK") {
		return nil, errors.New("Couldn't read your Gmail.")
	}
	var out []rawMail
	for _, r := range rs {
		m := gmIDRe.FindStringSubmatch(r.text)
		if m == nil || len(r.lits) == 0 {
			continue
		}
		id, _ := strconv.ParseUint(m[1], 10, 64)
		hex := strconv.FormatUint(id, 16)
		rm := parseMail(r.lits[len(r.lits)-1])
		rm.ID, rm.Source, rm.Link = hex, "Gmail", "https://mail.google.com/mail/u/0/#all/"+hex
		out = append(out, rm)
	}
	return out, nil
}

var wordDec = &mime.WordDecoder{CharsetReader: func(cs string, in io.Reader) (io.Reader, error) { return in, nil }}

func decodeHeader(s string) string {
	if d, err := wordDec.DecodeHeader(s); err == nil {
		return d
	}
	return s
}

// parseMail pulls the sender, subject, date and readable text out of a raw
// (possibly cut short) message. A cut-off message still gives what it can.
func parseMail(raw []byte) rawMail {
	var rm rawMail
	msg, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		return rm
	}
	rm.Subject = decodeHeader(msg.Header.Get("Subject"))
	if a, err := mail.ParseAddress(decodeHeader(msg.Header.Get("From"))); err == nil {
		rm.From = strings.TrimSpace(a.Name + " <" + a.Address + ">")
	} else {
		rm.From = decodeHeader(msg.Header.Get("From"))
	}
	if t, err := msg.Header.Date(); err == nil {
		rm.Received = t.In(time.Local).Format(time.RFC3339)
	}
	rm.Body = mailText(msg.Header.Get("Content-Type"), msg.Header.Get("Content-Transfer-Encoding"), msg.Body, 0)
	return rm
}

func mailText(ctype, enc string, body io.Reader, depth int) string {
	mt, params, err := mime.ParseMediaType(ctype)
	if err != nil {
		mt = "text/plain"
	}
	if strings.HasPrefix(mt, "multipart/") && depth < 5 {
		mr := multipart.NewReader(body, params["boundary"])
		var plain, htm string
		for {
			p, err := mr.NextPart()
			if err != nil {
				break
			}
			t := mailText(p.Header.Get("Content-Type"), p.Header.Get("Content-Transfer-Encoding"), p, depth+1)
			pt, _, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
			switch {
			case pt == "text/html" && htm == "":
				htm = t
			case plain == "" && t != "":
				plain = t
			}
		}
		if plain != "" {
			return plain
		}
		return htm
	}
	if !strings.HasPrefix(mt, "text/") {
		return ""
	}
	var r io.Reader = body
	switch strings.ToLower(strings.TrimSpace(enc)) {
	case "quoted-printable":
		r = quotedprintable.NewReader(body)
	case "base64":
		r = base64.NewDecoder(base64.StdEncoding, &lineJoiner{r: body})
	}
	b, _ := io.ReadAll(io.LimitReader(r, 200<<10))
	s := string(b)
	if mt == "text/html" {
		s = htmlToText(s)
	}
	return collapseSpace(s)
}

// lineJoiner drops line breaks so the base64 decoder sees one long line.
type lineJoiner struct{ r io.Reader }

func (l *lineJoiner) Read(p []byte) (int, error) {
	n, err := l.r.Read(p)
	j := 0
	for i := 0; i < n; i++ {
		if p[i] != '\r' && p[i] != '\n' {
			p[j] = p[i]
			j++
		}
	}
	return j, err
}

var (
	htmlDrop  = regexp.MustCompile(`(?is)<(style|script|head)[^>]*>.*?</(style|script|head)>`)
	htmlBreak = regexp.MustCompile(`(?i)<(br|/p|/div|/tr|/li|/h\d)[^>]*>`)
	htmlTag   = regexp.MustCompile(`<[^>]+>`)
	spaceRun  = regexp.MustCompile(`[ \t\x{a0}]+`)
	lineRun   = regexp.MustCompile(`\n\s*\n+`)
)

func htmlToText(s string) string {
	s = htmlDrop.ReplaceAllString(s, "")
	s = htmlBreak.ReplaceAllString(s, "\n")
	s = htmlTag.ReplaceAllString(s, "")
	return html.UnescapeString(s)
}

func collapseSpace(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = spaceRun.ReplaceAllString(s, " ")
	return strings.TrimSpace(lineRun.ReplaceAllString(s, "\n\n"))
}
