package github

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/go-github/v61/github"
)

type MinimalWorkflowFailure struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	JobName        string    `json:"job_name"`
	ErrorSignature string    `json:"error_signature"`
	HTMLURL        string    `json:"html_url"`
	CreatedAt      time.Time `json:"created_at"`

	Branch     string `json:"branch"`
	HeadSHA    string `json:"head_sha"`
	CommitMsg  string `json:"commit_msg"`

	PRNumber int    `json:"pr_number,omitempty"`
	PRTitle  string `json:"pr_title,omitempty"`
	PRBody   string `json:"pr_body,omitempty"`
}

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func FetchWorkflowFailures(client *github.Client, owner, repo string) ([]MinimalWorkflowFailure, error) {
	ctx := context.Background()
	cutoff := time.Now().AddDate(0, -3, 0)
	maxFailures := 20

	log.Printf("[ingest] fetching workflow crashes for %s/%s", owner, repo)

	runs, _, err := client.Actions.ListRepositoryWorkflowRuns(ctx, owner, repo, &github.ListWorkflowRunsOptions{
		Status:      "failure",
		ListOptions: github.ListOptions{PerPage: 40},
	})
	if err != nil {
		return nil, err
	}

	var failures []MinimalWorkflowFailure
	for _, run := range runs.WorkflowRuns {
		if len(failures) >= maxFailures || run.GetCreatedAt().Before(cutoff) {
			continue
		}

		jobOpts := &github.ListWorkflowJobsOptions{Filter: "latest"}
		jobs, _, err := client.Actions.ListWorkflowJobs(ctx, owner, repo, run.GetID(), jobOpts)
		if err != nil || jobs == nil || len(jobs.Jobs) == 0 {
			continue
		}

		var failedJobID int64
		var jobName string
		for _, j := range jobs.Jobs {
			if j.GetConclusion() == "failure" {
				failedJobID = j.GetID()
				jobName = j.GetName()
				break
			}
		}
		if failedJobID == 0 { continue }

		url, _, err := client.Actions.GetWorkflowJobLogs(ctx, owner, repo, failedJobID, 3)
		if err != nil { continue }
		rawTail, _ := downloadLogContent(url.String())

		f := MinimalWorkflowFailure{
			ID:             run.GetID(),
			Name:           run.GetName(),
			JobName:        jobName,
			ErrorSignature: cleanANSI(rawTail),
			HTMLURL:        run.GetHTMLURL(),
			CreatedAt:      run.GetCreatedAt().Time,
			Branch:         run.GetHeadBranch(),
			HeadSHA:        run.GetHeadSHA(),
		}

		commit, _, err := client.Repositories.GetCommit(ctx, owner, repo, f.HeadSHA, nil)
		if err == nil {
			f.CommitMsg = commit.GetCommit().GetMessage()
		}

		var prNumber int
		if len(run.PullRequests) > 0 {
			prNumber = run.PullRequests[0].GetNumber()
		} else {
			prs, _, _ := client.PullRequests.ListPullRequestsWithCommit(ctx, owner, repo, f.HeadSHA, nil)
			if len(prs) > 0 {
				prNumber = prs[0].GetNumber()
			}
		}

		if prNumber != 0 {
			fullPR, _, err := client.PullRequests.Get(ctx, owner, repo, prNumber)
			if err == nil {
				f.PRNumber = fullPR.GetNumber()
				f.PRTitle  = fullPR.GetTitle()
				f.PRBody   = fullPR.GetBody()
			}
		}

		failures = append(failures, f)
	}

	_ = writeJSON("crashes.json", failures)
	return failures, nil
}
func downloadLogContent(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err == nil {
		var combined []string
		for _, file := range zipReader.File {
			rc, _ := file.Open()
			content, _ := io.ReadAll(rc)
			rc.Close()
			combined = append(combined, tailLines(string(content), 50))
		}
		return strings.Join(combined, "\n---\n"), nil
	}

	return tailLines(string(body), 50), nil
}

func tailLines(data string, n int) string {
	lines := strings.Split(strings.TrimSpace(data), "\n")
	if len(lines) <= n {
		return data
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}

func cleanANSI(text string) string {
	return ansiRegex.ReplaceAllString(text, "")
}