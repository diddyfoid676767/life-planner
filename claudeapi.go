package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// The user's own Claude API key, used by the Ask Claude chat and the direct
// email check. Kept in data/claude-api.json and never sent back to the page.
type aiConf struct {
	Key   string `json:"key"`
	Model string `json:"model,omitempty"`
}

const aiDefaultModel = "claude-opus-5-5"

var aiModels = map[string]bool{"claude-opus-5-5": true, "claude-sonnet-5-5": true, "claude-haiku-5-5": true}

var aiMu sync.Mutex

func aiConfPath() string { return filepath.Join(dataDir, "claude-api.json") }

func loadAI() aiConf {
	var c aiConf
	if b, err := os.ReadFile(aiConfPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	if !aiModels[c.Model] {
		c.Model = aiDefaultModel
	}
	return c
}

func aiClient(c aiConf) anthropic.Client {
	return anthropic.NewClient(option.WithAPIKey(c.Key), option.WithRequestTimeout(3*time.Minute))
}

// aiErrText turns an API error into a sentence for the page.
func aiErrText(err error) string {
	var apierr *anthropic.Error
	if errors.As(err, &apierr) {
		switch apierr.StatusCode {
		case 401, 403:
			return "Claude didn't accept the API key. Paste a new one in Settings, App."
		case 402:
			return "Your Claude API account is out of credit. Top it up at console.anthropic.com."
		case 429:
			return "Too many requests right now. Try again in a minute."
		case 529, 500, 502, 503:
			return "Claude is busy right now. Try again in a minute."
		}
		return "Claude couldn't answer (error " + http.StatusText(apierr.StatusCode) + ")."
	}
	return "Couldn't reach Claude. Check your internet connection."
}

func handleAI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	aiMu.Lock()
	defer aiMu.Unlock()
	c := loadAI()
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]any{"configured": c.Key != "", "model": c.Model})
	case http.MethodPut:
		var in struct {
			Key   *string `json:"key"`
			Model string  `json:"model"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, "bad request")
			return
		}
		if in.Key != nil {
			k := strings.TrimSpace(*in.Key)
			if k != "" && (!strings.HasPrefix(k, "sk-ant-") || strings.ContainsAny(k, " \t\r\n")) {
				writeErr(w, http.StatusBadRequest, "That doesn't look like a Claude API key. It starts with sk-ant-.")
				return
			}
			c.Key = k
		}
		if aiModels[in.Model] {
			c.Model = in.Model
		}
		os.MkdirAll(dataDir, 0o755)
		b, _ := json.Marshal(c)
		if err := os.WriteFile(aiConfPath(), b, 0o600); err != nil {
			writeErr(w, http.StatusInternalServerError, "Couldn't save the key.")
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"configured": c.Key != "", "model": c.Model})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method")
	}
}

const chatSystem = `You are Claude, built into Life Planner, a desktop app for a high school student in Melbourne, Australia that plans study, school work, training and health, with a garden and an arena game for motivation.
Each message comes with what is on the student's screen right now (the page name and its text). Use it to answer questions about that page, explain things, help plan, quiz them, or help with schoolwork. If the answer isn't on the page and you don't know it, say so.
You can't change the planner yourself. When a change would help, say exactly what to add or move so they can do it in a few clicks.
Write short, friendly, plain answers. Use short paragraphs or a few bullet points, and **bold** for the key thing. No headings.`

// handleAIChat streams Claude's answer as server-sent events:
// data: {"t":"text"} ... then data: {"done":true} or data: {"error":"..."}.
func handleAIChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var in struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
		Page  string `json:"page"`
		Today string `json:"today"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 400<<10)).Decode(&in); err != nil || len(in.Messages) == 0 {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	c := loadAI()
	if c.Key == "" {
		writeErr(w, http.StatusNotFound, "Add your Claude API key in Settings, App first.")
		return
	}
	// Keep the conversation alternating user/assistant and starting with the user.
	var msgs []anthropic.MessageParam
	for _, m := range in.Messages {
		text := strings.TrimSpace(m.Content)
		if text == "" {
			continue
		}
		if len(text) > 20000 {
			text = text[:20000]
		}
		if m.Role == "assistant" {
			if len(msgs) > 0 {
				msgs = append(msgs, anthropic.NewAssistantMessage(anthropic.NewTextBlock(text)))
			}
			continue
		}
		msgs = append(msgs, anthropic.NewUserMessage(anthropic.NewTextBlock(text)))
	}
	if len(msgs) == 0 || msgs[len(msgs)-1].Role != anthropic.MessageParamRoleUser {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	page := in.Page
	if len(page) > 60000 {
		page = page[:60000]
	}
	// The screen goes after the cached instructions, so the instructions stay cacheable.
	system := []anthropic.TextBlockParam{
		{Text: chatSystem, CacheControl: anthropic.NewCacheControlEphemeralParam()},
		{Text: plannerProfile() + "\nToday is " + in.Today + ".\n\n<screen>\n" + page + "\n</screen>"},
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	fl, _ := w.(http.Flusher)
	send := func(v any) {
		b, _ := json.Marshal(v)
		w.Write([]byte("data: "))
		w.Write(b)
		w.Write([]byte("\n\n"))
		if fl != nil {
			fl.Flush()
		}
	}
	client := aiClient(c)
	stream := client.Messages.NewStreaming(r.Context(), anthropic.MessageNewParams{
		Model:        c.Model,
		MaxTokens:    16000,
		System:       system,
		Messages:     msgs,
		OutputConfig: anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow},
	})
	stop := ""
	for stream.Next() {
		switch ev := stream.Current().AsAny().(type) {
		case anthropic.ContentBlockDeltaEvent:
			if d, ok := ev.Delta.AsAny().(anthropic.TextDelta); ok {
				send(map[string]string{"t": d.Text})
			}
		case anthropic.MessageDeltaEvent:
			stop = string(ev.Delta.StopReason)
		}
	}
	if err := stream.Err(); err != nil {
		if r.Context().Err() == nil {
			send(map[string]string{"error": aiErrText(err)})
		}
		return
	}
	if stop == "refusal" {
		send(map[string]string{"error": "Claude can't help with that one."})
		return
	}
	send(map[string]any{"done": true, "cut": stop == "max_tokens"})
}

// aiJSON asks Claude for a JSON answer that matches schema and decodes it into out.
func aiJSON(ctx context.Context, c aiConf, system, prompt string, schema map[string]any, out any) error {
	client := aiClient(c)
	resp, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.Model,
		MaxTokens: 16000,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
		OutputConfig: anthropic.OutputConfigParam{
			Effort: anthropic.OutputConfigEffortLow,
			Format: anthropic.JSONOutputFormatParam{Schema: schema},
		},
	})
	if err != nil {
		return err
	}
	if resp.StopReason == anthropic.StopReasonRefusal {
		return errors.New("Claude declined to sort these emails")
	}
	for _, b := range resp.Content {
		if t, ok := b.AsAny().(anthropic.TextBlock); ok {
			return json.Unmarshal([]byte(t.Text), out)
		}
	}
	return errors.New("Claude sent back an empty answer")
}
