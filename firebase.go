package main

// The friends server is a Firebase project on the free (Spark) plan: Firebase
// Auth for usernames and passwords, Firestore for profiles, chats and the
// synced planner. There are no server functions on the free plan, so every
// rule about what a person may write (coins, stats, rate limits, sizes) lives
// in firestore.rules, which Google checks on every write. The app talks to the
// REST APIs with the signed-in person's ID token.

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	fbKey     = "AIzaSyCucsGSWVIGnGYmmlOifIvYsEHC1FtBQjs" // web API key from the Firebase console (public; the rules guard the data)
	fbProject = "life-planner-4663f"                      // project id
	fbAuthURL = "https://identitytoolkit.googleapis.com/v1"
	fbTokURL  = "https://securetoken.googleapis.com/v1"
	fbDocURL  = "https://firestore.googleapis.com/v1"
)

// LP_FB_KEY and LP_FB_PROJECT point the app at another project, and
// LP_FB_AUTH_HOST / LP_FB_DOC_HOST at the emulators, for testing.
func init() {
	if k, p := os.Getenv("LP_FB_KEY"), os.Getenv("LP_FB_PROJECT"); k != "" && p != "" {
		fbKey, fbProject = k, p
	}
	if h := os.Getenv("LP_FB_AUTH_HOST"); h != "" {
		fbAuthURL, fbTokURL = h+"/identitytoolkit.googleapis.com/v1", h+"/securetoken.googleapis.com/v1"
	}
	if h := os.Getenv("LP_FB_DOC_HOST"); h != "" {
		fbDocURL = h + "/v1"
	}
}

func fbOn() bool { return fbKey != "" && fbProject != "" }

var fbClient = &http.Client{Timeout: 20 * time.Second}

// fbErr is an error from Firebase, with its HTTP code and status word
// (PERMISSION_DENIED, FAILED_PRECONDITION, EMAIL_EXISTS...).
type fbErr struct {
	Code   int
	Status string
	Msg    string
}

func (e *fbErr) Error() string { return e.Msg }

func fbStatus(err error) string {
	if e, ok := err.(*fbErr); ok {
		return e.Status
	}
	return ""
}

func fbCall(method, u, token string, body any, out any) error {
	var rd io.Reader
	ct := "application/json"
	switch b := body.(type) {
	case nil:
	case url.Values:
		rd, ct = strings.NewReader(b.Encode()), "application/x-www-form-urlencoded"
	default:
		j, _ := json.Marshal(b)
		rd = bytes.NewReader(j)
	}
	req, _ := http.NewRequest(method, u, rd)
	req.Header.Set("Content-Type", ct)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := fbClient.Do(req)
	if err != nil {
		return &fbErr{Msg: "Couldn't reach the friends server. Check your internet connection."}
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if res.StatusCode >= 300 {
		var e struct {
			Error struct {
				Message string `json:"message"`
				Status  string `json:"status"`
			} `json:"error"`
		}
		json.Unmarshal(b, &e)
		if len(b) > 0 && b[0] == '[' { // runQuery errors come as a one-item list
			var l []json.RawMessage
			if json.Unmarshal(b, &l) == nil && len(l) > 0 {
				json.Unmarshal(l[0], &e)
			}
		}
		st, msg := e.Error.Status, e.Error.Message
		if st == "" { // Auth errors: the message is the status word
			st = strings.SplitN(msg, " ", 2)[0]
		}
		if msg == "" {
			msg = res.Status
		}
		if st == "PERMISSION_DENIED" {
			if os.Getenv("LP_FB_EMU") == "" {
				msg = "The server said no to that."
			}
		}
		return &fbErr{Code: res.StatusCode, Status: st, Msg: msg}
	}
	if out != nil && len(b) > 0 {
		return json.Unmarshal(b, out)
	}
	return nil
}

// ---------- auth ----------

type fbAuthResp struct {
	IDToken      string `json:"idToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    string `json:"expiresIn"`
	LocalID      string `json:"localId"`
}

func (r fbAuthResp) account(username string) *account {
	n, _ := strconv.ParseInt(r.ExpiresIn, 10, 64)
	return &account{Backend: "fb", UserID: r.LocalID, Username: username, Access: r.IDToken, Refresh: r.RefreshToken, Expires: time.Now().Unix() + n}
}

func fbSignIn(email, pw string) (fbAuthResp, error) {
	var r fbAuthResp
	err := fbCall("POST", fbAuthURL+"/accounts:signInWithPassword?key="+fbKey, "", map[string]any{"email": email, "password": pw, "returnSecureToken": true}, &r)
	return r, err
}

func fbSignUp(email, pw string) (fbAuthResp, error) {
	var r fbAuthResp
	err := fbCall("POST", fbAuthURL+"/accounts:signUp?key="+fbKey, "", map[string]any{"email": email, "password": pw, "returnSecureToken": true}, &r)
	return r, err
}

func fbRefresh(a *account) (*account, error) {
	var r struct {
		IDToken      string `json:"id_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    string `json:"expires_in"`
		UserID       string `json:"user_id"`
	}
	if err := fbCall("POST", fbTokURL+"/token?key="+fbKey, "", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {a.Refresh}}, &r); err != nil {
		return nil, err
	}
	return fbAuthResp{IDToken: r.IDToken, RefreshToken: r.RefreshToken, ExpiresIn: r.ExpiresIn, LocalID: r.UserID}.account(a.Username), nil
}

func fbDeleteUser(a *account) error {
	return fbCall("POST", fbAuthURL+"/accounts:delete?key="+fbKey, "", map[string]string{"idToken": a.Access}, nil)
}

// ---------- Firestore ----------

func fsRoot() string            { return "projects/" + fbProject + "/databases/(default)/documents" }
func fsName(path string) string { return fsRoot() + "/" + path }

// fsDoc is a Firestore document turned back into plain JSON values.
type fsDoc struct {
	ID      string
	Path    string
	Fields  map[string]any
	Updated string // updateTime: changes on every write
}

type rawDoc struct {
	Name       string                     `json:"name"`
	Fields     map[string]json.RawMessage `json:"fields"`
	UpdateTime string                     `json:"updateTime"`
}

func (d rawDoc) doc() *fsDoc {
	f := map[string]any{}
	for k, v := range d.Fields {
		f[k] = fsDecode(v)
	}
	p := strings.TrimPrefix(d.Name, fsRoot()+"/")
	return &fsDoc{ID: p[strings.LastIndex(p, "/")+1:], Path: p, Fields: f, Updated: d.UpdateTime}
}

// fsGet reads one document; nil, nil when it doesn't exist. mask limits the
// fields sent back.
func fsGet(token, path string, mask ...string) (*fsDoc, error) {
	q := url.Values{}
	for _, m := range mask {
		q.Add("mask.fieldPaths", m)
	}
	var d rawDoc
	err := fbCall("GET", fbDocURL+"/"+fsName(path)+"?"+q.Encode(), token, nil, &d)
	if fbStatus(err) == "NOT_FOUND" {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return d.doc(), nil
}

// fsGetMany reads documents by path; missing ones are left out.
func fsGetMany(token string, paths []string) (map[string]*fsDoc, error) {
	out := map[string]*fsDoc{}
	if len(paths) == 0 {
		return out, nil
	}
	names := make([]string, len(paths))
	for i, p := range paths {
		names[i] = fsName(p)
	}
	var res []struct {
		Found *rawDoc `json:"found"`
	}
	if err := fbCall("POST", fbDocURL+"/"+fsRoot()+":batchGet", token, map[string]any{"documents": names}, &res); err != nil {
		return nil, err
	}
	for _, r := range res {
		if r.Found != nil {
			d := r.Found.doc()
			out[d.Path] = d
		}
	}
	return out, nil
}

// fsQuery runs a structured query on a collection (parent "" is the root,
// otherwise a document path such as "chats/<id>").
func fsQuery(token, parent string, q map[string]any) ([]*fsDoc, error) {
	u := fbDocURL + "/" + fsRoot()
	if parent != "" {
		u += "/" + parent
	}
	var res []struct {
		Document *rawDoc `json:"document"`
	}
	if err := fbCall("POST", u+":runQuery", token, map[string]any{"structuredQuery": q}, &res); err != nil {
		return nil, err
	}
	var out []*fsDoc
	for _, r := range res {
		if r.Document != nil {
			out = append(out, r.Document.doc())
		}
	}
	return out, nil
}

func fsWhere(field, op string, v any) map[string]any {
	return map[string]any{"fieldFilter": map[string]any{"field": map[string]string{"fieldPath": field}, "op": op, "value": fsEncode(v, false)}}
}

func fsAnd(fs ...map[string]any) map[string]any {
	if len(fs) == 1 {
		return fs[0]
	}
	return map[string]any{"compositeFilter": map[string]any{"op": "AND", "filters": fs}}
}

// fsWrite is one write in a commit.
type fsWrite map[string]any

// fsSet writes fields to a document. With merge only those fields change
// (the rest are kept); stamp fields get the server's time (request.time in
// the rules). pre is a precondition: "new" (must not exist), "old" (must
// exist), an updateTime, or "".
func fsSet(path string, fields map[string]any, merge bool, pre string, stamp ...string) fsWrite {
	w := fsWrite{"update": map[string]any{"name": fsName(path), "fields": fsFields(fields)}}
	if merge {
		keys := make([]string, 0, len(fields))
		for k := range fields {
			keys = append(keys, fsField(k))
		}
		sort.Strings(keys)
		w["updateMask"] = map[string]any{"fieldPaths": keys}
	}
	if len(stamp) > 0 {
		var t []map[string]string
		for _, s := range stamp {
			t = append(t, map[string]string{"fieldPath": fsField(s), "setToServerValue": "REQUEST_TIME"})
		}
		w["updateTransforms"] = t
	}
	switch pre {
	case "":
	case "new":
		w["currentDocument"] = map[string]bool{"exists": false}
	case "old":
		w["currentDocument"] = map[string]bool{"exists": true}
	default:
		w["currentDocument"] = map[string]string{"updateTime": pre}
	}
	return w
}

func fsDel(path string) fsWrite { return fsWrite{"delete": fsName(path)} }

// fsField quotes a field path segment that isn't a plain identifier (uids
// used as map keys can start with a digit).
func fsField(k string) string {
	parts := strings.Split(k, ".")
	for i, p := range parts {
		plain := p != ""
		for j, c := range p {
			if !(c == '_' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || j > 0 && c >= '0' && c <= '9') {
				plain = false
			}
		}
		if !plain {
			parts[i] = "`" + strings.ReplaceAll(strings.ReplaceAll(p, `\`, `\\`), "`", "\\`") + "`"
		}
	}
	return strings.Join(parts, ".")
}

// fsCommit applies writes all together; it returns the documents' new update times.
func fsCommit(token string, ws ...fsWrite) ([]string, error) {
	var r struct {
		WriteResults []struct {
			UpdateTime string `json:"updateTime"`
		} `json:"writeResults"`
		CommitTime string `json:"commitTime"`
	}
	if err := fbCall("POST", fbDocURL+"/"+fsRoot()+":commit", token, map[string]any{"writes": ws}, &r); err != nil {
		return nil, err
	}
	out := make([]string, len(r.WriteResults))
	for i, x := range r.WriteResults {
		out[i] = x.UpdateTime
		if out[i] == "" {
			out[i] = r.CommitTime
		}
	}
	return out, nil
}

// ---------- values ----------

func fsFields(m map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range m {
		if strings.Contains(k, ".") { // a nested path (only used with merge): build the map
			top, rest, _ := strings.Cut(k, ".")
			sub, _ := out[top].(map[string]any)
			if sub == nil {
				sub = map[string]any{"mapValue": map[string]any{"fields": map[string]any{}}}
				out[top] = sub
			}
			inner := sub["mapValue"].(map[string]any)["fields"].(map[string]any)
			for kk, vv := range fsFields(map[string]any{rest: v}) {
				inner[kk] = vv
			}
			continue
		}
		out[k] = fsEncode(v, false)
	}
	return out
}

// fsEncode turns a JSON value into a Firestore value. Firestore can't hold a
// list directly inside a list, so an inner list is wrapped as {"__a": [...]}
// and unwrapped again by fsDecode.
func fsEncode(v any, inList bool) map[string]any {
	switch x := v.(type) {
	case nil:
		return map[string]any{"nullValue": nil}
	case bool:
		return map[string]any{"booleanValue": x}
	case string:
		return map[string]any{"stringValue": x}
	case int:
		return map[string]any{"integerValue": strconv.Itoa(x)}
	case int64:
		return map[string]any{"integerValue": strconv.FormatInt(x, 10)}
	case float64:
		if x == math.Trunc(x) && math.Abs(x) < 1<<53 {
			return map[string]any{"integerValue": strconv.FormatInt(int64(x), 10)}
		}
		return map[string]any{"doubleValue": x}
	case json.Number:
		if i, err := x.Int64(); err == nil {
			return map[string]any{"integerValue": strconv.FormatInt(i, 10)}
		}
		f, _ := x.Float64()
		return map[string]any{"doubleValue": f}
	case json.RawMessage:
		val, err := decodeJSON(x)
		if err != nil {
			return map[string]any{"nullValue": nil}
		}
		return fsEncode(val, inList)
	case time.Time:
		return map[string]any{"timestampValue": x.UTC().Format(time.RFC3339Nano)}
	case []string:
		l := make([]any, len(x))
		for i, s := range x {
			l[i] = s
		}
		return fsEncode(l, inList)
	case []any:
		vals := make([]any, len(x))
		for i, e := range x {
			vals[i] = fsEncode(e, true)
		}
		arr := map[string]any{"arrayValue": map[string]any{"values": vals}}
		if inList {
			return map[string]any{"mapValue": map[string]any{"fields": map[string]any{"__a": arr}}}
		}
		return arr
	case map[string]any:
		return map[string]any{"mapValue": map[string]any{"fields": fsFields(x)}}
	}
	// anything else: go through JSON
	b, _ := json.Marshal(v)
	val, _ := decodeJSON(b)
	return fsEncode(val, inList)
}

func fsDecode(raw json.RawMessage) any {
	var v map[string]json.RawMessage
	if json.Unmarshal(raw, &v) != nil {
		return nil
	}
	for k, x := range v {
		switch k {
		case "stringValue", "timestampValue", "referenceValue":
			var s string
			json.Unmarshal(x, &s)
			return s
		case "booleanValue":
			var b bool
			json.Unmarshal(x, &b)
			return b
		case "integerValue":
			var s string
			json.Unmarshal(x, &s)
			n, _ := strconv.ParseInt(s, 10, 64)
			return float64(n)
		case "doubleValue":
			var f float64
			json.Unmarshal(x, &f)
			return f
		case "arrayValue":
			var a struct {
				Values []json.RawMessage `json:"values"`
			}
			json.Unmarshal(x, &a)
			out := make([]any, len(a.Values))
			for i, e := range a.Values {
				out[i] = fsDecode(e)
			}
			return out
		case "mapValue":
			var m struct {
				Fields map[string]json.RawMessage `json:"fields"`
			}
			json.Unmarshal(x, &m)
			if len(m.Fields) == 1 && m.Fields["__a"] != nil {
				return fsDecode(m.Fields["__a"])
			}
			out := map[string]any{}
			for kk, e := range m.Fields {
				out[kk] = fsDecode(e)
			}
			return out
		}
	}
	return nil
}

func str(v any) string { s, _ := v.(string); return s }

func num(v any) float64 { f, _ := v.(float64); return f }

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6], b[8] = b[6]&0x0f|0x40, b[8]&0x3f|0x80
	h := hex.EncodeToString(b)
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[:8], h[8:12], h[12:16], h[16:20], h[20:])
}
