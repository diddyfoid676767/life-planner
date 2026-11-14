package main

// 2.67 (build stage 8, launch): accounts with a real email.
//
// Westbourne students sign up with their school address. Firebase emails them
// a link, and opening it proves they own that inbox. The address must also be
// on the year list to count as a Westbourne student. The year list never ships
// in the app or the repository: the database holds one document per student
// (yr/<salted hash of the address>) that only someone signed in with that
// verified address can read. It holds their name, encrypted with a key made
// from the address, and whether they get the beta badge. Anyone else, or any
// address not on the list, gets planner-only mode (no houses).
//
// Everyone gets a hidden handle (u_ + their account id) as their username, so
// chats, friends lists and houses keep working; people find each other by name
// or school email, never by handle.

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	schoolDomain = "westbourne.vic.edu.au"
	yrSalt       = "solis-yr-2027|" // yr/<hash>: must match yrHash() in firestore.rules
	ehSalt       = "solis-eh-2027|" // profiles.eh, for "add a friend by school email"
	icSalt       = "solis-ic|"      // invite codes: must match icOf() in firestore.rules
	// the owner's verified school address, hashed the same way as the year list
	ownerHash = "1b448bb28f2dff805d95d9061ffaf234a2ea6ede4463b0b1d8f69eb38b9fc3a8"
)

var emailRe = regexp.MustCompile(`^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$`)

func normEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func hashHex(salt, s string) string {
	h := sha256.Sum256([]byte(salt + s))
	return hex.EncodeToString(h[:])
}
func yrHash(email string) string { return hashHex(yrSalt, normEmail(email)) }
func ehOf(email string) string   { return hashHex(ehSalt, normEmail(email)) }
func icOf(uid string) string     { return hashHex(icSalt, uid)[:6] }
func isOwnerEmail(email string) bool {
	return email != "" && yrHash(email) == ownerHash
}

// handleOf is the hidden username of an email account. It must match
// handleOf() in firestore.rules.
func handleOf(uid string) string {
	s := strings.ToLower(uid)
	if len(s) > 18 {
		s = s[:18]
	}
	return "u_" + s
}

func nameKey(email string) []byte {
	k := sha256.Sum256([]byte("solis-name|" + normEmail(email)))
	return k[:]
}

// sealName encrypts a name so only someone who knows the address can read it.
func sealName(email, name string) string {
	g, _ := cipher.NewGCM(must(aes.NewCipher(nameKey(email))))
	nonce := make([]byte, g.NonceSize())
	rand.Read(nonce)
	return base64.StdEncoding.EncodeToString(g.Seal(nonce, nonce, []byte(name), nil))
}

func openName(email, sealed string) string {
	b, err := base64.StdEncoding.DecodeString(sealed)
	if err != nil {
		return ""
	}
	g, _ := cipher.NewGCM(must(aes.NewCipher(nameKey(email))))
	if len(b) < g.NonceSize() {
		return ""
	}
	out, err := g.Open(nil, b[:g.NonceSize()], b[g.NonceSize():], nil)
	if err != nil {
		return ""
	}
	return string(out)
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

// ---------- Firebase Auth email actions ----------

func fbSendVerify(a *account) error {
	return fbCall("POST", fbAuthURL+"/accounts:sendOobCode?key="+fbKey, "", map[string]any{"requestType": "VERIFY_EMAIL", "idToken": a.Access}, nil)
}

func fbSendReset(email string) error {
	return fbCall("POST", fbAuthURL+"/accounts:sendOobCode?key="+fbKey, "", map[string]any{"requestType": "PASSWORD_RESET", "email": email}, nil)
}

// fbEmailVerified asks Firebase whether the address has been confirmed.
func fbEmailVerified(a *account) (bool, error) {
	var r struct {
		Users []struct {
			EmailVerified bool `json:"emailVerified"`
		} `json:"users"`
	}
	if err := fbCall("POST", fbAuthURL+"/accounts:lookup?key="+fbKey, "", map[string]any{"idToken": a.Access}, &r); err != nil {
		return false, err
	}
	return len(r.Users) > 0 && r.Users[0].EmailVerified, nil
}

// forceRefresh gets a new ID token, so a just-confirmed email shows up as
// email_verified in the rules.
func forceRefresh(a *account) (*account, error) {
	n, err := fbRefresh(a)
	if err != nil {
		return nil, err
	}
	keepAcct(n, a)
	return n, nil
}

// keepAcct copies what a refreshed token doesn't carry.
func keepAcct(n, a *account) {
	if n.UserID == "" {
		n.UserID = a.UserID
	}
	n.Email, n.Verified, n.School, n.Name = a.Email, a.Verified, a.School, a.Name
}

// emailSignUp makes an account with a real email and sends the link.
func emailSignUp(email, pw, name, inviter string) (*account, error) {
	ar, err := fbSignUp(email, pw)
	if err != nil {
		switch fbStatus(err) {
		case "EMAIL_EXISTS":
			return nil, fmt.Errorf("There's already an account with that email. Log in instead.")
		case "INVALID_EMAIL":
			return nil, fmt.Errorf("That email doesn't look right.")
		case "WEAK_PASSWORD":
			return nil, fmt.Errorf("Pick a longer password (8+ characters).")
		}
		return nil, err
	}
	a := ar.account(handleOf(ar.LocalID))
	a.Email = email
	f := map[string]any{"display": name, "ic": icOf(a.UserID)}
	if inviter != "" && inviter != a.UserID {
		f["inv"] = inviter
	}
	if err := createProfile(a, f, nil); err != nil {
		return nil, fmt.Errorf("Couldn't save your profile: %v", err)
	}
	// 2.67.4: no emailed link (school filters ate it). A Westbourne address on
	// the year list counts straight away; the first account made with an
	// address owns it.
	if _, err := finishVerify(a); err != nil {
		return nil, err
	}
	return a, nil
}

func emailLogIn(email, pw string) (*account, error) {
	ar, err := fbSignIn(email, pw)
	if err != nil {
		switch fbStatus(err) {
		case "INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_EMAIL":
			return nil, fmt.Errorf("Wrong email or password.")
		case "TOO_MANY_ATTEMPTS_TRY_LATER":
			return nil, fmt.Errorf("Too many tries. Wait a few minutes, or reset your password.")
		}
		return nil, err
	}
	a := ar.account(handleOf(ar.LocalID))
	a.Email = email
	if p, _ := fsGet(a.Access, "profiles/"+a.UserID, "username"); p == nil {
		createProfile(a, map[string]any{"ic": icOf(a.UserID)}, nil)
	}
	if _, err := finishVerify(a); err != nil {
		return nil, err
	}
	return a, nil
}

// finishVerify runs once the email is confirmed: a Westbourne address on the
// year list marks the profile verified, fills in the real name and gives the
// beta badge to the beta testers. Returns whether they're a Westbourne student.
func finishVerify(a *account) (bool, error) {
	a.Verified = true
	email := normEmail(a.Email)
	owner := isOwnerEmail(email)
	if !strings.HasSuffix(email, "@"+schoolDomain) {
		a.School = false
		return false, nil
	}
	doc, err := fsGet(a.Access, "yr/"+yrHash(email))
	if err != nil {
		return false, fmt.Errorf("Couldn't check the year list: %v", err)
	}
	if doc == nil { // not on the year list (the owner adds it with the owner tools first)
		a.School = false
		return false, nil
	}
	name := cut(strings.TrimSpace(openName(email, str(doc.Fields["n"]))), 30)
	beta, _ := doc.Fields["b"].(bool)
	cur, err := fsGet(a.Access, "profiles/"+a.UserID)
	if err != nil {
		return false, err
	}
	if cur == nil {
		if err := createProfile(a, map[string]any{"ic": icOf(a.UserID)}, nil); err != nil {
			return false, err
		}
		cur, _ = fsGet(a.Access, "profiles/"+a.UserID)
	}
	f := map[string]any{"v": true, "eh": ehOf(email)}
	if name != "" {
		f["display"], f["dl"] = name, strings.ToLower(name)
	}
	var badges []string
	if cur != nil {
		if l, ok := cur.Fields["badges"].([]any); ok {
			for _, b := range l {
				badges = append(badges, str(b))
			}
		}
	}
	want := []string{}
	if owner {
		want = append(want, "dev")
	}
	if beta || contains(badges, "beta") {
		want = append(want, "beta")
	}
	if strings.Join(want, ",") != strings.Join(badges, ",") {
		f["badges"] = want
	}
	ws := []fsWrite{fsSet("profiles/"+a.UserID, f, true, "old")}
	if owner {
		ws = append(ws, fsSet("config/owner", map[string]any{"uid": a.UserID}, false, ""))
	}
	if cur != nil && cur.Fields["v"] == true && cur.Fields["eh"] == f["eh"] && f["badges"] == nil && (name == "" || cur.Fields["display"] == name) && !owner {
		ws = nil // nothing to change
	}
	if len(ws) > 0 {
		if _, err := fsCommit(a.Access, ws...); err != nil {
			return false, fmt.Errorf("Couldn't mark you as verified: %v", err)
		}
	}
	a.School, a.Name = true, name
	return true, nil
}

func contains(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

// POST /api/account/email {action: signup|login|resend|check|reset, email, password, name, inviter}
func handleAccountEmail(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost || !fbOn() {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		Action, Email, Password, Name, Inviter string
	}
	if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in) != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	email := normEmail(in.Email)
	needEmail := in.Action == "signup" || in.Action == "login" || in.Action == "reset"
	if needEmail && !emailRe.MatchString(email) {
		writeErr(w, http.StatusBadRequest, "That email doesn't look right.")
		return
	}
	if (in.Action == "signup" || in.Action == "login") && (len(in.Password) < 8 || len(in.Password) > 72) {
		writeErr(w, http.StatusBadRequest, "Passwords need at least 8 characters.")
		return
	}
	var a *account
	var err error
	switch in.Action {
	case "signup":
		if !regexp.MustCompile(`^[A-Za-z0-9_-]{0,40}$`).MatchString(in.Inviter) {
			in.Inviter = ""
		}
		a, err = emailSignUp(email, in.Password, cut(strings.TrimSpace(in.Name), 30), in.Inviter)
	case "login":
		a, err = emailLogIn(email, in.Password)
	case "reset":
		if err := fbSendReset(email); err != nil && fbStatus(err) != "EMAIL_NOT_FOUND" {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	case "resend", "check":
		if a, err = session(); err != nil {
			writeErr(w, http.StatusUnauthorized, err.Error())
			return
		}
		if a.Email == "" {
			writeErr(w, http.StatusBadRequest, "This account has no email yet.")
			return
		}
		if in.Action == "resend" {
			if err := fbSendVerify(a); err != nil {
				msg := err.Error()
				if fbStatus(err) == "TOO_MANY_ATTEMPTS_TRY_LATER" {
					msg = "Too many emails sent. Wait a few minutes and try again."
				}
				writeErr(w, http.StatusBadGateway, msg)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
			return
		}
		_, err = finishVerify(a)
	default:
		writeErr(w, http.StatusBadRequest, "unknown action")
		return
	}
	if err != nil {
		code := http.StatusBadGateway
		if in.Action == "login" {
			code = http.StatusUnauthorized
		}
		writeErr(w, code, err.Error())
		return
	}
	if err := saveAccount(a); err != nil {
		writeErr(w, http.StatusInternalServerError, "Couldn't save your login.")
		return
	}
	if in.Action != "check" {
		go cloudSync(false)
	}
	json.NewEncoder(w).Encode(acctState(a))
}

// acctState is what the page is told about the signed-in account.
func acctState(a *account) map[string]any {
	return map[string]any{"ok": true, "username": a.Username, "email": a.Email, "verified": a.Verified, "school": a.School,
		"name": a.Name, "legacy": a.Email == "", "owner": a.Verified && isOwnerEmail(a.Email), "uid": a.UserID, "ic": icOf(a.UserID)}
}

// ---------- launch switch ----------

var launchMu sync.Mutex
var launchCache struct {
	at   time.Time
	data map[string]any
}

// launchInfo reads config/launch (set by the owner's Launch button), at most
// every 10 minutes.
func launchInfo() map[string]any {
	launchMu.Lock()
	defer launchMu.Unlock()
	if launchCache.data != nil && time.Since(launchCache.at) < 10*time.Minute {
		return launchCache.data
	}
	out := map[string]any{"reset": false, "at": ""}
	if d, err := fsGet("", "config/launch"); err == nil {
		if d != nil {
			out["reset"], out["at"] = d.Fields["reset"] == true, str(d.Fields["at"])
		}
		launchCache.at, launchCache.data = time.Now(), out
	}
	return out
}

// ---------- owner tools ----------

var hex64 = regexp.MustCompile(`^[0-9a-f]{64}$`)

// POST /api/account/owner: only works for the owner's verified account (the
// rules check it again on every write).
//
//	{action: "yr", entries: [{h, n, b}]}   load the hashed year list
//	{action: "badges", u, badges}          set someone's badges by hand
//	{action: "launch", reset: true}        the launch-day reset for everyone
func handleAccountOwner(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost || !fbOn() {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	a, err := session()
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	if !a.Verified || !isOwnerEmail(a.Email) {
		writeErr(w, http.StatusForbidden, "Only the owner can do that.")
		return
	}
	var in struct {
		Action  string `json:"action"`
		Entries []struct {
			H string `json:"h"`
			N string `json:"n"`
			B bool   `json:"b"`
		} `json:"entries"`
		U      string   `json:"u"`
		Badges []string `json:"badges"`
		Reset  bool     `json:"reset"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&in) != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	switch in.Action {
	case "yr":
		if len(in.Entries) == 0 || len(in.Entries) > 2000 {
			writeErr(w, http.StatusBadRequest, "No entries in that file.")
			return
		}
		var ws []fsWrite
		for _, e := range in.Entries {
			if !hex64.MatchString(e.H) || len(e.N) > 300 {
				writeErr(w, http.StatusBadRequest, "That file isn't a Solis year list.")
				return
			}
			ws = append(ws, fsSet("yr/"+e.H, map[string]any{"n": e.N, "b": e.B}, false, ""))
		}
		for i := 0; i < len(ws); i += 300 {
			if _, err := fsCommit(a.Access, ws[i:min(i+300, len(ws))]...); err != nil {
				writeErr(w, http.StatusBadGateway, err.Error())
				return
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "n": len(ws)})
	case "badges":
		if !usernameRe.MatchString(in.U) || len(in.Badges) > 3 {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		for _, b := range in.Badges {
			if b != "beta" && b != "dev" {
				writeErr(w, http.StatusBadRequest, "unknown badge")
				return
			}
		}
		u, err := fsGet("", "usernames/"+in.U)
		if err != nil || u == nil {
			writeErr(w, http.StatusNotFound, "No one with that account.")
			return
		}
		if in.Badges == nil {
			in.Badges = []string{}
		}
		if _, err := fsCommit(a.Access, fsSet("profiles/"+str(u.Fields["uid"]), map[string]any{"badges": in.Badges}, true, "old")); err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	case "launch":
		if !in.Reset {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		at := time.Now().UTC().Format(time.RFC3339)
		if _, err := fsCommit(a.Access, fsSet("config/launch", map[string]any{"reset": true, "at": at}, false, "")); err != nil {
			writeErr(w, http.StatusBadGateway, err.Error())
			return
		}
		launchMu.Lock()
		launchCache.data = nil
		launchMu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "at": at})
	default:
		writeErr(w, http.StatusBadRequest, "unknown action")
	}
}
