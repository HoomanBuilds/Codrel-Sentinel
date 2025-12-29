package github

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type User struct {
	Login string `json:"login"`
	Type  string `json:"type"`
}

type Label struct {
	Name string `json:"name"`
}

type Issue struct {
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	State     string     `json:"state"`
	HTMLURL   string     `json:"html_url"`
	User      User       `json:"user"`
	Labels    []Label    `json:"labels"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`

	PullRequest *struct {
		URL string `json:"url"`
	} `json:"pull_request,omitempty"`

	IssueType  string   `json:"issue_type"`
	ChangeHint string   `json:"change_hint"`
	Keywords   []string `json:"keywords"`
	TimeBucket string   `json:"time_bucket"`
}

func FetchClosedIssuesRaw(
	token string,
	owner string,
	repo string,
) ([]Issue, error) {

	url := fmt.Sprintf(
		"https://api.github.com/repos/%s/%s/issues?state=closed&per_page=100",
		owner, repo,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var issues []Issue
	if err := json.Unmarshal(raw, &issues); err != nil {
		return nil, err
	}

	now := time.Now()

	filtered := make([]Issue, 0, len(issues))

	for i := range issues {

		if issues[i].PullRequest != nil {
			continue
		}

		issues[i].IssueType = detectIssueType(&issues[i])
		issues[i].ChangeHint = detectChangeHint(issues[i].Title, issues[i].Body)
		issues[i].Keywords = extractKeywords(issues[i].Title, issues[i].Body)
		issues[i].TimeBucket = timeBucket(issues[i].ClosedAt, now)

		filtered = append(filtered, issues[i])
	}

	_ = writeJSON("bugs.json", filtered)
	log.Printf("[raw] HTTP %d | total=%d", resp.StatusCode, len(filtered))

	return filtered, nil
}

func detectIssueType(i *Issue) string {
	if i.PullRequest != nil {
		return "pr-linked"
	}
	return "issue"
}

func detectChangeHint(title, body string) string {
	t := strings.ToLower(title + " " + body)

	switch {
	case strings.Contains(t, "fix"),
		strings.Contains(t, "bug"),
		strings.Contains(t, "error"),
		strings.Contains(t, "crash"):
		return "bugfix"
	case strings.Contains(t, "feat"),
		strings.Contains(t, "feature"),
		strings.Contains(t, "add"):
		return "feature"
	case strings.Contains(t, "refactor"),
		strings.Contains(t, "cleanup"),
		strings.Contains(t, "restructure"):
		return "refactor"
	case strings.Contains(t, "test"),
		strings.Contains(t, "jest"),
		strings.Contains(t, "ci"):
		return "test"
	default:
		return "other"
	}
}

func extractKeywords(title, body string) []string {
	text := strings.ToLower(title + " " + body)

	stop := map[string]bool{
		"the": true, "and": true, "or": true, "to": true,
		"a": true, "of": true, "in": true, "on": true,
		"for": true, "with": true, "is": true,
	}

	words := strings.FieldsFunc(text, func(r rune) bool {
		return r < 'a' || r > 'z'
	})

	seen := map[string]bool{}
	var out []string

	for _, w := range words {
		if len(w) < 3 || stop[w] {
			continue
		}
		if !seen[w] {
			seen[w] = true
			out = append(out, w)
		}
		if len(out) >= 8 {
			break
		}
	}

	return out
}

func timeBucket(closed *time.Time, now time.Time) string {
	if closed == nil {
		return "unknown"
	}
	d := now.Sub(*closed)

	switch {
	case d <= 7*24*time.Hour:
		return "last_7d"
	case d <= 30*24*time.Hour:
		return "last_30d"
	default:
		return "older"
	}
}
