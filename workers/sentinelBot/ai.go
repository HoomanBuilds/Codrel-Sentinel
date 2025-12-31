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
	return strings.TrimSpace(
"You are reviewing a pull request.\n\n" +

"Your goal:\n" +
"- Identify risks only when supported by historical data or concrete evidence\n" +
"- Focus on changed code paths\n" +
"- Stay concise, neutral, and technical\n" +
"- Avoid speculation, praise, or generic advice\n\n" +

"Write the review comment as a human senior engineer would.\n\n" +
"---\n\n" +

"## Summary\n" +
"Briefly describe whether this PR introduces risk. If none, say so clearly.\n\n" +

"## Observations\n" +
"List only findings that are directly supported by:\n" +
"- Historical failures\n" +
"- Similar past incidents\n" +
"- Known regressions in the same files or patterns\n\n" +
"If there are no such signals, omit this section.\n\n" +

"## Evidence\n" +
"For each risk, show the exact code that matters.\n\n" +

"**Before**\n" +
"```go\n" +
"<relevant previous code>\n" +
"```\n\n" +

"**After**\n" +
"```go\n" +
"<current changed code>\n" +
"```\n\n" +

"Explain why the change is risky in one or two sentences.\n\n" +

"## Suggested Action\n" +
"- Concrete, minimal changes to reduce risk\n" +
"- Or explicitly state: No action needed\n\n" +

"---\n\n" +

"Context (do not restate unless relevant):\n\n" +

"Repository: " + repo + "\n" +
"PR: #" + itoa(prNumber) + "\n" +
"Title: " + title + "\n\n" +

"Description:\n" +
truncate(body, 1500) + "\n\n" +

"Changed Files:\n" +
"- " + strings.Join(paths, "\n- ") + "\n\n" +

"Diffs:\n" +
strings.Join(diffBlock, "\n\n") + "\n\n" +

"Historical Context (factual):\n" +
string(riskJSON) + "\n\n" +

"Rules:\n" +
"- Warn only if historical evidence exists\n" +
"- If risk score < 0.3 and no matches, state clearly that no significant risk was found\n" +
"- Never invent incidents\n",
)

}

func filesToPaths(files []ChangedFile) []string {
	out := make([]string, 0, len(files))
	for _, f := range files {
		out = append(out, f.Path)
	}
	return out
}