// yrlist turns a pasted year list ("Name" <email>, "Name" <email>, ...) into
// year-list-hashes.json for Settings, Owner tools, Load the year list. The
// output holds only a salted hash of each address and the name encrypted with
// a key made from that address, so it can't be read without knowing the
// emails. The list itself is read from stdin and never written anywhere.
//
//	go run ./tools/yrlist -beta "Jules Deglas,Jasper Carr" -add "you@school=Your Name" < list.txt > year-list-hashes.json
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
)

// must match launch.go
const yrSalt = "solis-yr-2027|"

func norm(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func seal(email, name string) string {
	k := sha256.Sum256([]byte("solis-name|" + norm(email)))
	b, _ := aes.NewCipher(k[:])
	g, _ := cipher.NewGCM(b)
	nonce := make([]byte, g.NonceSize())
	rand.Read(nonce)
	return base64.StdEncoding.EncodeToString(g.Seal(nonce, nonce, []byte(name), nil))
}

// display turns "Gabriel (Gabe) Shadwick" into "Gabe Shadwick".
func display(n string) string {
	n = strings.Join(strings.Fields(n), " ")
	if m := regexp.MustCompile(`^(.*?)\(\s*([^)]+?)\s*\)\s*(.*)$`).FindStringSubmatch(n); m != nil {
		n = strings.TrimSpace(m[2] + " " + m[3])
	}
	if len([]rune(n)) > 30 {
		n = string([]rune(n)[:30])
	}
	return n
}

func main() {
	beta := flag.String("beta", "", "comma-separated names (as on the list) who get the beta badge")
	add := flag.String("add", "", "extra entries: email=Name,email=Name")
	flag.Parse()
	in, _ := io.ReadAll(os.Stdin)
	type entry struct {
		H string `json:"h"`
		N string `json:"n"`
		B bool   `json:"b,omitempty"`
	}
	betas := map[string]bool{}
	for _, b := range strings.Split(*beta, ",") {
		if b = strings.ToLower(strings.TrimSpace(b)); b != "" {
			betas[b] = true
		}
	}
	var out []entry
	seen := map[string]bool{}
	found := map[string]bool{}
	put := func(name, email string) {
		h := sha256.Sum256([]byte(yrSalt + norm(email)))
		hx := hex.EncodeToString(h[:])
		if seen[hx] {
			return
		}
		seen[hx] = true
		key := strings.ToLower(strings.Join(strings.Fields(name), " "))
		b := betas[key] || betas[strings.ToLower(display(name))]
		if b {
			found[key] = true
		}
		out = append(out, entry{H: hx, N: seal(email, display(name)), B: b})
	}
	for _, m := range regexp.MustCompile(`"([^"]+)"\s*<([^>]+)>`).FindAllStringSubmatch(string(in), -1) {
		put(m[1], m[2])
	}
	for _, kv := range strings.Split(*add, ",") {
		if p := strings.SplitN(kv, "=", 2); len(p) == 2 {
			put(p[1], p[0])
		}
	}
	fmt.Fprintf(os.Stderr, "%d entries, %d beta\n", len(out), len(found))
	json.NewEncoder(os.Stdout).Encode(map[string]any{"v": 1, "entries": out})
}
