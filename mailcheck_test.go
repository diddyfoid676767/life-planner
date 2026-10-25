package main

import (
	"bufio"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func selfSigned(t *testing.T) tls.Certificate {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	tpl := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "localhost"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), DNSNames: []string{"localhost"}}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
}

// fakeIMAP serves two messages: a multipart quoted-printable one and a base64 HTML one.
func fakeIMAP(t *testing.T, msgs []string) string {
	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{selfSigned(t)}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				r := bufio.NewReader(c)
				fmt.Fprint(c, "* OK fake ready\r\n")
				for {
					line, err := r.ReadString('\n')
					if err != nil {
						return
					}
					f := strings.SplitN(strings.TrimSpace(line), " ", 3)
					tag, cmd := f[0], strings.ToUpper(f[1])
					switch {
					case cmd == "LOGIN":
						if strings.Contains(line, `"good"`) {
							fmt.Fprintf(c, "%s OK logged in\r\n", tag)
						} else {
							fmt.Fprintf(c, "%s NO [AUTHENTICATIONFAILED] bad\r\n", tag)
						}
					case cmd == "EXAMINE":
						fmt.Fprintf(c, "* %d EXISTS\r\n%s OK [READ-ONLY] done\r\n", len(msgs), tag)
					case cmd == "UID" && strings.HasPrefix(f[2], "SEARCH"):
						fmt.Fprintf(c, "* SEARCH 11 12\r\n%s OK done\r\n", tag)
					case cmd == "UID" && strings.HasPrefix(f[2], "FETCH"):
						for i, m := range msgs {
							fmt.Fprintf(c, "* %d FETCH (UID %d X-GM-MSGID %d BODY[]<0> {%d}\r\n%s)\r\n", i+1, 11+i, 1786000000000000001+i, len(m), m)
						}
						fmt.Fprintf(c, "%s OK done\r\n", tag)
					case cmd == "LOGOUT":
						fmt.Fprintf(c, "* BYE\r\n%s OK bye\r\n", tag)
						return
					default:
						fmt.Fprintf(c, "%s BAD what\r\n", tag)
					}
				}
			}(c)
		}
	}()
	return ln.Addr().String()
}

const mailQP = "From: =?UTF-8?Q?Ms_Smith?= <smith@school.vic.edu.au>\r\nSubject: Physics SAC 2 =?UTF-8?Q?=E2=80=94?= moved\r\nDate: Mon, 26 Oct 2026 09:00:00 +1100\r\nContent-Type: multipart/alternative; boundary=b1\r\n\r\n--b1\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThe Physics SAC is now on Thursday 29 Oct at 9:15am. Bring a calcu=\r\nlator.\r\n--b1\r\nContent-Type: text/html\r\n\r\n<p>html copy</p>\r\n--b1--\r\n"
const mailHTML = "From: Shop <deals@shop.com>\r\nSubject: 50% off\r\nDate: Mon, 26 Oct 2026 08:00:00 +1100\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\nPGgxPkJpZyBzYWxlPC9oMT48c3R5bGU+eHt9PC9zdHlsZT48cD5CdXkgbm93ITwvcD4=\r\n"

func TestParseMail(t *testing.T) {
	m := parseMail([]byte(mailQP))
	if m.Subject != "Physics SAC 2 — moved" || m.From != "Ms Smith <smith@school.vic.edu.au>" {
		t.Fatalf("headers: %+v", m)
	}
	if !strings.Contains(m.Body, "Bring a calculator.") || strings.Contains(m.Body, "html copy") {
		t.Fatalf("body: %q", m.Body)
	}
	h := parseMail([]byte(mailHTML))
	if h.Body != "Big sale\nBuy now!" && !strings.Contains(h.Body, "Buy now!") || strings.Contains(h.Body, "x{}") {
		t.Fatalf("html body: %q", h.Body)
	}
}

func TestDirectMailCheck(t *testing.T) {
	dataDir = t.TempDir()
	addr := fakeIMAP(t, []string{mailQP, mailHTML})
	imapAddr = addr
	imapTLS = func() *tls.Config { return &tls.Config{InsecureSkipVerify: true} }

	var prompt string
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Content []struct{ Text string } `json:"content"`
			} `json:"messages"`
			OutputConfig map[string]any `json:"output_config"`
		}
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &body)
		if body.OutputConfig["format"] == nil {
			t.Errorf("no structured output format sent")
		}
		prompt = body.Messages[0].Content[0].Text
		// the shop email is n=1 and the SAC n=0, in fetch order
		ans := `{"summary":"Physics SAC moved to Thursday.","emails":[{"n":0,"keep":true,"category":"Deadline","subject":"Physics SAC 2","summary":"Now Thursday 9:15am, bring a calculator.","due":"2026-10-29","time":"09:15"},{"n":1,"keep":false,"category":"FYI","subject":"","summary":"","due":"","time":""}]}`
		out, _ := json.Marshal(map[string]any{"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
			"content": []map[string]any{{"type": "text", "text": ans}}, "stop_reason": "end_turn", "usage": map[string]int{"input_tokens": 10, "output_tokens": 10}})
		w.Header().Set("Content-Type", "application/json")
		w.Write(out)
	}))
	defer api.Close()
	t.Setenv("ANTHROPIC_BASE_URL", api.URL)

	os.WriteFile(filepath.Join(dataDir, "claude-api.json"), []byte(`{"key":"sk-ant-test"}`), 0o600)
	os.WriteFile(mailConfPath(), []byte(`{"user":"eli@gmail.com","pass":"good"}`), 0o600)
	os.WriteFile(filepath.Join(dataDir, "missed-info.json"), []byte(`{"updated":"x","summary":"old","reported":["r1"],"items":[{"id":"old1","category":"FYI","subject":"Old","received":"`+time.Now().Format(time.RFC3339)+`"}]}`), 0o644)

	n, err := runMailCheck(t.Context())
	if err != nil || n != 1 {
		t.Fatalf("added %d, err %v", n, err)
	}
	if !strings.Contains(prompt, "Bring a calculator.") || !strings.Contains(prompt, "50% off") {
		t.Fatalf("prompt missing emails: %s", prompt)
	}
	var info struct {
		Summary  string
		Reported []string
		Items    []inboxItem
	}
	b, _ := os.ReadFile(filepath.Join(dataDir, "missed-info.json"))
	json.Unmarshal(b, &info)
	if len(info.Items) != 2 || info.Reported[0] != "r1" || info.Summary != "Physics SAC moved to Thursday." {
		t.Fatalf("merged file: %s", b)
	}
	it := info.Items[1]
	if it.ID != fmt.Sprintf("%x", uint64(1786000000000000001)) || it.Due != "2026-10-29" || it.Time != "09:15" || it.Source != "Gmail" || !strings.HasSuffix(it.Link, it.ID) {
		t.Fatalf("item: %+v", it)
	}
	// A second check sends nothing new to Claude.
	prompt = ""
	mailLastRun = time.Time{}
	if n, err := runMailCheck(t.Context()); err != nil || n != 0 || prompt != "" {
		t.Fatalf("second run: %d %v %q", n, err, prompt)
	}
	// A wrong password says so.
	if err := imapTest(t.Context(), mailConf{"eli@gmail.com", "bad"}); err == nil || !strings.Contains(err.Error(), "app password") {
		t.Fatalf("bad login: %v", err)
	}
}

func TestChatStream(t *testing.T) {
	dataDir = t.TempDir()
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), `u003cscreen`) || !strings.Contains(string(b), `"stream":true`) {
			t.Errorf("request: %s", b)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		ev := func(name, data string) { fmt.Fprintf(w, "event: %s\ndata: %s\n\n", name, data) }
		ev("message_start", `{"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":null,"usage":{"input_tokens":1,"output_tokens":0}}}`)
		ev("content_block_start", `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`)
		ev("content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}`)
		ev("content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Eli"}}`)
		ev("content_block_stop", `{"type":"content_block_stop","index":0}`)
		ev("message_delta", `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}`)
		ev("message_stop", `{"type":"message_stop"}`)
	}))
	defer api.Close()
	t.Setenv("ANTHROPIC_BASE_URL", api.URL)
	os.WriteFile(filepath.Join(dataDir, "claude-api.json"), []byte(`{"key":"sk-ant-test"}`), 0o600)
	req := httptest.NewRequest("POST", "/api/ai/chat", strings.NewReader(`{"messages":[{"role":"user","content":"hi"}],"page":"Page: Today","today":"Monday"}`))
	rec := httptest.NewRecorder()
	handleAIChat(rec, req)
	out := rec.Body.String()
	if !strings.Contains(out, `{"t":"Hello "}`) || !strings.Contains(out, `{"t":"Eli"}`) || !strings.Contains(out, `"done":true`) {
		t.Fatalf("stream: %s", out)
	}
}
