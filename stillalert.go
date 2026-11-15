package main

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"net/http"
	"sync"
)

var stillMu struct {
	sync.Mutex
	open, closed bool
}

// POST /api/stillhere {text}: shows the on-top question and waits for the answer
// ("yes", "no", "closed" when the app answered it first, "none" when it can't be shown).
// POST /api/stillhere?close=1 closes an open one.
func handleStillHere(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if r.URL.Query().Get("close") != "" {
		stillMu.Lock()
		if stillMu.open {
			stillMu.closed = true
			closeStillAlert()
		}
		stillMu.Unlock()
		json.NewEncoder(w).Encode(map[string]string{"answer": "ok"})
		return
	}
	var b struct{ Text string }
	json.NewDecoder(r.Body).Decode(&b)
	if b.Text == "" {
		b.Text = "Are you still studying?"
	}
	stillMu.Lock()
	if stillMu.open {
		stillMu.Unlock()
		json.NewEncoder(w).Encode(map[string]string{"answer": "busy"})
		return
	}
	stillMu.open, stillMu.closed = true, false
	stillMu.Unlock()
	a := showStillAlert(b.Text)
	stillMu.Lock()
	if stillMu.closed {
		a = "closed"
	}
	stillMu.open = false
	stillMu.Unlock()
	json.NewEncoder(w).Encode(map[string]string{"answer": a})
}

// makeChime builds a short, loud three-note alarm as a WAV file in memory.
func makeChime() []byte {
	const rate = 22050
	notes := []float64{988, 1319, 1568, 0, 988, 1319, 1568}
	n := rate * 18 / 100
	var pcm []byte
	for _, f := range notes {
		for i := 0; i < n; i++ {
			v := 0.0
			if f > 0 {
				env := math.Min(1, float64(i)/200) * math.Min(1, float64(n-i)/800)
				t := float64(i) / rate
				v = env * (0.75*math.Sin(2*math.Pi*f*t) + 0.2*math.Sin(4*math.Pi*f*t))
			}
			pcm = binary.LittleEndian.AppendUint16(pcm, uint16(int16(v*32000)))
		}
	}
	h := make([]byte, 0, 44+len(pcm))
	h = append(h, "RIFF"...)
	h = binary.LittleEndian.AppendUint32(h, uint32(36+len(pcm)))
	h = append(h, "WAVEfmt "...)
	h = binary.LittleEndian.AppendUint32(h, 16)
	h = binary.LittleEndian.AppendUint16(h, 1)
	h = binary.LittleEndian.AppendUint16(h, 1)
	h = binary.LittleEndian.AppendUint32(h, rate)
	h = binary.LittleEndian.AppendUint32(h, rate*2)
	h = binary.LittleEndian.AppendUint16(h, 2)
	h = binary.LittleEndian.AppendUint16(h, 16)
	h = append(h, "data"...)
	h = binary.LittleEndian.AppendUint32(h, uint32(len(pcm)))
	return append(h, pcm...)
}
