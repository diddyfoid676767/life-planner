package main

// mergePlanner merges two changed copies of the planner the same way
// web/merge.js does (see the rules there): the copy here and the one from the
// phone, when both changed since the copy last synced (base). base may be nil
// (no synced copy kept yet), and then nothing is deleted. merge_test.go runs
// both versions on the same cases.

import (
	"bytes"
	"encoding/json"
	"math"
	"sort"
	"strconv"
)

type missingT struct{}

var missing any = missingT{} // not there on that side

var mergeCounters = map[string]bool{"spent": true, "bonus": true, "opened": true, "bank": true, "pastBank": true, "xp": true}

func decodeJSON(b []byte) (any, error) {
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	var v any
	if err := d.Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

func encodeJSON(v any) []byte {
	var buf bytes.Buffer
	e := json.NewEncoder(&buf)
	e.SetEscapeHTML(false)
	e.Encode(v)
	return bytes.TrimRight(buf.Bytes(), "\n")
}

func mergePlanner(base, mine, theirs []byte) ([]byte, error) {
	m, err := decodeJSON(mine)
	if err != nil {
		return nil, err
	}
	t, err := decodeJSON(theirs)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return theirs, nil
	}
	if t == nil {
		return mine, nil
	}
	var b any = missing
	noBase := true
	if len(base) > 0 {
		if bv, err := decodeJSON(base); err == nil && bv != nil {
			b, noBase = bv, false
		}
	}
	return encodeJSON(mergeVal(b, m, t, "", noBase)), nil
}

func numVal(v any) (float64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := n.Float64()
	return f, err == nil
}

func sameVal(a, b any) bool {
	switch x := a.(type) {
	case json.Number:
		y, ok := b.(json.Number)
		if !ok {
			return false
		}
		if x == y {
			return true
		}
		fx, e1 := x.Float64()
		fy, e2 := y.Float64()
		return e1 == nil && e2 == nil && fx == fy
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for k, v := range x {
			w, ok := y[k]
			if !ok || !sameVal(v, w) {
				return false
			}
		}
		return true
	case []any:
		y, ok := b.([]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for i := range x {
			if !sameVal(x[i], y[i]) {
				return false
			}
		}
		return true
	}
	return a == b
}

// canonJSON matches canon in merge.js: object keys sorted, numbers as JS prints them
func canonJSON(v any) string {
	switch x := v.(type) {
	case json.Number:
		if f, err := x.Float64(); err == nil {
			if f == math.Trunc(f) && math.Abs(f) < 1e21 {
				return strconv.FormatFloat(f, 'f', -1, 64)
			}
			return strconv.FormatFloat(f, 'g', -1, 64)
		}
		return string(x)
	case map[string]any:
		ks := make([]string, 0, len(x))
		for k := range x {
			ks = append(ks, k)
		}
		sort.Strings(ks)
		var s bytes.Buffer
		s.WriteByte('{')
		for i, k := range ks {
			if i > 0 {
				s.WriteByte(',')
			}
			s.Write(encodeJSON(k))
			s.WriteByte(':')
			s.WriteString(canonJSON(x[k]))
		}
		s.WriteByte('}')
		return s.String()
	case []any:
		var s bytes.Buffer
		s.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				s.WriteByte(',')
			}
			s.WriteString(canonJSON(e))
		}
		s.WriteByte(']')
		return s.String()
	}
	return string(encodeJSON(v))
}

type keyedList struct {
	keys []string
	vals map[string]any
}

func keyList(arr []any) keyedList {
	out := keyedList{vals: map[string]any{}}
	seen := map[string]int{}
	for _, x := range arr {
		var k0 string
		if o, ok := x.(map[string]any); ok {
			switch id := o["id"].(type) {
			case string:
				k0 = "istring:" + id
			case json.Number:
				k0 = "inumber:" + canonJSON(id)
			}
		}
		if k0 == "" {
			k0 = "j" + canonJSON(x)
		}
		seen[k0]++
		k := k0 + "#" + strconv.Itoa(seen[k0])
		out.keys = append(out.keys, k)
		out.vals[k] = x
	}
	return out
}

func (l keyedList) get(k string) any {
	if v, ok := l.vals[k]; ok {
		return v
	}
	return missing
}

func mergeList(b any, m, t []any) []any {
	ba, hasBase := b.([]any)
	var B keyedList
	if hasBase {
		B = keyList(ba)
	}
	M, T := keyList(m), keyList(t)
	bget := func(k string) any {
		if !hasBase {
			return missing
		}
		return B.get(k)
	}
	after := map[string][]any{}
	cur := ""
	for _, k := range T.keys {
		if _, ok := M.vals[k]; ok {
			cur = k
			continue
		}
		if v := mergeVal(bget(k), missing, T.vals[k], "", !hasBase); v != missing {
			after[cur] = append(after[cur], v)
		}
	}
	out := append([]any{}, after[""]...)
	for _, k := range M.keys {
		if v := mergeVal(bget(k), M.vals[k], T.get(k), "", !hasBase); v != missing {
			out = append(out, v)
		}
		out = append(out, after[k]...)
	}
	return out
}

func mergeVal(b, m, t any, key string, noBase bool) any {
	if sameVal(m, t) {
		return m
	}
	if !noBase {
		if sameVal(b, m) {
			return t
		}
		if sameVal(b, t) {
			return m
		}
	}
	if m == missing {
		return t
	}
	if t == missing {
		return m
	}
	ma, mok := m.([]any)
	ta, tok := t.([]any)
	if mok && tok {
		if noBase {
			b = missing
		}
		return mergeList(b, ma, ta)
	}
	mo, mok := m.(map[string]any)
	to, tok := t.(map[string]any)
	if mok && tok {
		bo, hasBase := b.(map[string]any)
		hasBase = hasBase && !noBase
		bget := func(k string) any {
			if !hasBase {
				return missing
			}
			if v, ok := bo[k]; ok {
				return v
			}
			return missing
		}
		out := map[string]any{}
		for k, mv := range mo {
			tv, ok := to[k]
			if !ok {
				tv = missing
			}
			if v := mergeVal(bget(k), mv, tv, k, !hasBase); v != missing {
				out[k] = v
			}
		}
		for k, tv := range to {
			if _, ok := mo[k]; !ok {
				if v := mergeVal(bget(k), missing, tv, k, !hasBase); v != missing {
					out[k] = v
				}
			}
		}
		return out
	}
	// counters (coins spent...) changed on both sides add both changes
	if mergeCounters[key] {
		bf, ok1 := numVal(b)
		mf, ok2 := numVal(m)
		tf, ok3 := numVal(t)
		if ok1 && ok2 && ok3 {
			return json.Number(strconv.FormatFloat(math.Max(0, mf+tf-bf), 'f', -1, 64))
		}
	}
	return m
}
