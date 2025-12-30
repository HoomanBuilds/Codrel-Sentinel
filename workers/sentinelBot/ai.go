package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func buildFinalComment(prompt string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("missing GEMINI_API_KEY")
	}

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
	}

	b, _ := json.Marshal(body)

	req, _ := http.NewRequest(
		"POST",
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+apiKey,
		bytes.NewBuffer(b),
	)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 40 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}

	if len(out.Candidates) == 0 ||
		len(out.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty Gemini response")
	}

	return out.Candidates[0].Content.Parts[0].Text, nil
}

func buildPrompt(
	repo string,
	prNumber int,
	title string,
	body string,
	files []ChangedFile,
	diffMap map[string]string,
	risk *RiskResponse,
) string {
	var diffBlock []string
	for f, d := range diffMap {
		if d == "" {
			continue
		}
		diffBlock = append(diffBlock,
			"FILE: "+f+"\n"+truncate(d, 1800),
		)
	}

	riskJSON, _ := json.MarshalIndent(risk, "", "  ")
	paths := filesToPaths(files)
	return strings.TrimSpace(`
SYSTEM ROLE:
You are an automated Pull Request Risk Reviewer bot.

You must:
- Compare current code changes with historical failures
- Warn only if evidence exists
- Be concise, technical, and actionable
- Never speculate or praise

OUTPUT FORMAT (STRICT MARKDOWN):

### ⚠️ Risk Analysis Summary
(one paragraph)

### 🔍 Historical Signals
(bullets only if any exist)

### 📌 Files of Interest
(files + reason)

### ✅ Recommendation
(clear actions or "No action needed")

---

PR METADATA:
Repository: ` + repo + `
PR Number: ` + itoa(prNumber) + `

PR TITLE:
` + title + `

PR DESCRIPTION:
` + truncate(body, 1500) + `

CHANGED FILES:
- ` + strings.Join(paths, "\n- ") + `

CODE DIFFS:
` + strings.Join(diffBlock, "\n\n") + `

HISTORICAL RISK CONTEXT (FACTUAL JSON):
` + string(riskJSON) + `

DECISION RULES:
- If historical failures match current files → warn
- If risk < 0.3 and no history → say "No significant historical risk detected"
- Never invent incidents
`)
}

func filesToPaths(files []ChangedFile) []string {
	out := make([]string, 0, len(files))
	for _, f := range files {
		out = append(out, f.Path)
	}
	return out
}