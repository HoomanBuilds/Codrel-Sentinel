package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/go-github/v61/github"
	_ "github.com/lib/pq"
)

func callRiskAPI(
	ev PREvent,
	files []string,
	change string,
) (*RiskResponse, error) {

	reqBody := RiskRequest{
		Repo:   ev.Owner + "/" + ev.Repo,
		Files: files,
		Change: change,
	}

	b, _ := json.Marshal(reqBody)

	url := os.Getenv("RISK_API_URL")
	if url == "" {
		url = "http://localhost:3000"
	}

	req, _ := http.NewRequest(
		"POST",
		fmt.Sprintf("%s/api/repos/risk-analysis", url),
		bytes.NewReader(b),
	)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer INTERNAL_TOKEN")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var out RiskResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}

	return &out, nil
}

func buildChangeSummary(pr *github.PullRequest, files []ChangedFile) string {
	var b strings.Builder

	if t := strings.TrimSpace(pr.GetTitle()); t != "" {
		b.WriteString(t)
		b.WriteString("\n")
	}

	if body := strings.TrimSpace(pr.GetBody()); body != "" {
		b.WriteString(truncate(body, 600))
		b.WriteString("\n")
	}

	for _, f := range files {
		b.WriteString("- ")
		b.WriteString(f.Path)

		if f.Patch == "" {
			b.WriteString(": changed\n")
			continue
		}

		lines := extractSignalLines(f.Patch, 4)
		if len(lines) == 0 {
			b.WriteString(": refactor/format\n")
			continue
		}

		b.WriteString(":\n")
		for _, l := range lines {
			b.WriteString("  ")
			b.WriteString(l)
			b.WriteString("\n")
		}
	}

	return strings.TrimSpace(b.String())
}

func extractSignalLines(patch string, max int) []string {
	out := []string{}
	for _, l := range strings.Split(patch, "\n") {
		if (strings.HasPrefix(l, "+") || strings.HasPrefix(l, "-")) && len(out) < max {
			out = append(out, truncate(l, 180))
		}
	}
	return out
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n…(truncated)"
}

func itoa(i int) string {
	return strconv.FormatInt(int64(i), 10)
}

func getDB() (*sql.DB, error) {
	connStr := os.Getenv("DATABASE_URL")
	return sql.Open("postgres", connStr)
}

func recordSentinelEvent(ev PREvent, summary string) error {
	db, err := getDB()
	if err != nil {
		return err
	}
	defer db.Close()

	query := `
		INSERT INTO repo_file_events (
			repo, 
			file_path, 
			event_type, 
			severity_score, 
			severity_label, 
			created_at, 
			raw_payload
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	repoName := fmt.Sprintf("%s/%s", ev.Owner, ev.Repo)
	filePath := fmt.Sprintf("PR #%d", ev.PRNumber)
	eventType := "sentinel_response"
	severityScore := 0.0
	severityLabel := "low"
	createdAt := time.Now()

	payloadMap := map[string]string{"summary": summary}
	payloadBytes, _ := json.Marshal(payloadMap)

	_, err = db.Exec(query,
		repoName,
		filePath,
		eventType,
		severityScore,
		severityLabel,
		createdAt,
		payloadBytes,
	)

	return err
}