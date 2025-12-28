package github

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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

	writeJSON("bugs.json" , issues)
	log.Printf("[raw] HTTP %d | total=%d", resp.StatusCode, len(issues))

	return issues, nil
}
