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


type CodeChange struct {
	Filename string `json:"filename"`
	Patch    string `json:"patch"`
}

type ChangeContext struct {
	Type   string       `json:"type"`
	Branch string       `json:"branch"`
	Files  []CodeChange `json:"files"`
}

type WorkflowCrash struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	JobName        string    `json:"job_name"`
	ErrorSignature string    `json:"error_signature"`
	HTMLURL        string    `json:"html_url"`
	CreatedAt      time.Time `json:"created_at"`

	Branch    string `json:"branch"`
	HeadSHA   string `json:"head_sha"`
	CommitMsg string `json:"commit_msg"`

	Change ChangeContext `json:"change"`
}

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func FetchWorkflowFailures(
	client *github.Client,
	owner,
	repo string,
) ([]WorkflowCrash, error) {

	ctx := context.Background()
	cutoff := time.Now().AddDate(0, -3, 0)
	maxFailures := 20

	log.Printf("[ingest] fetching workflow crashes for %s/%s", owner, repo)

	runs, _, err := client.Actions.ListRepositoryWorkflowRuns(
		ctx,
		owner,
		repo,
		&github.ListWorkflowRunsOptions{
			Status:      "failure",
			ListOptions: github.ListOptions{PerPage: 40},
		},
	)
	if err != nil {
		return nil, err
	}

	var out []WorkflowCrash

	for _, run := range runs.WorkflowRuns {
		if len(out) >= maxFailures || run.GetCreatedAt().Before(cutoff) {
			continue
		}


		jobs, _, err := client.Actions.ListWorkflowJobs(
			ctx,
			owner,
			repo,
			run.GetID(),
			&github.ListWorkflowJobsOptions{Filter: "latest"},
		)
		if err != nil || len(jobs.Jobs) == 0 {
			continue
		}

		var failedJob *github.WorkflowJob
		for _, j := range jobs.Jobs {
			if j.GetConclusion() == "failure" {
				failedJob = j
				break
			}
		}
		if failedJob == nil {
			continue
		}


		logURL, _, err := client.Actions.GetWorkflowJobLogs(
			ctx,
			owner,
			repo,
			failedJob.GetID(),
			3,
		)
		if err != nil {
			continue
		}

		rawLog, _ := downloadLogContent(logURL.String())

		crash := WorkflowCrash{
			ID:             run.GetID(),
			Name:           run.GetName(),
			JobName:        failedJob.GetName(),
			ErrorSignature: cleanANSI(rawLog),
			HTMLURL:        run.GetHTMLURL(),
			CreatedAt:      run.GetCreatedAt().Time,
			Branch:         run.GetHeadBranch(),
			HeadSHA:        run.GetHeadSHA(),
		}


		commit, _, err := client.Repositories.GetCommit(
			ctx,
			owner,
			repo,
			crash.HeadSHA,
			nil,
		)
		if err == nil {
			crash.CommitMsg = commit.GetCommit().GetMessage()
		}


		var prNumber int
		if len(run.PullRequests) > 0 {
			prNumber = run.PullRequests[0].GetNumber()
		} else {
			prs, _, _ := client.PullRequests.ListPullRequestsWithCommit(
				ctx,
				owner,
				repo,
				crash.HeadSHA,
				nil,
			)
			if len(prs) > 0 {
				prNumber = prs[0].GetNumber()
			}
		}


		var changes []CodeChange

		prDiffOK := false
		changes = nil

		if prNumber != 0 {
			opt := &github.ListOptions{PerPage: 100, Page: 1}

			for {
				files, resp, err := client.PullRequests.ListFiles(
					ctx,
					owner,
					repo,
					prNumber,
					opt,
				)
				if err != nil {
					break
				}

				for _, f := range files {
					if f.GetPatch() == "" {
						continue
					}
					changes = append(changes, CodeChange{
						Filename: f.GetFilename(),
						Patch:    f.GetPatch(),
					})
				}

				if resp.NextPage == 0 {
					break
				}
				opt.Page = resp.NextPage
			}

			if len(changes) > 0 {
				crash.Change = ChangeContext{
					Type:   "pr",
					Branch: run.GetHeadBranch(),
					Files:  changes,
				}
				prDiffOK = true
			}
		}

		if !prDiffOK && commit != nil {
			changes = nil
			for _, f := range commit.Files {
				if f.GetPatch() == "" {
					continue
				}
				changes = append(changes, CodeChange{
					Filename: f.GetFilename(),
					Patch:    f.GetPatch(),
				})
			}

			crash.Change = ChangeContext{
				Type:   "direct",
				Branch: run.GetHeadBranch(),
				Files:  changes,
			}
		} else if commit != nil {

			for _, f := range commit.Files {
				changes = append(changes, CodeChange{
					Filename: f.GetFilename(),
					Patch:    f.GetPatch(),
				})
			}

			crash.Change = ChangeContext{
				Type:   "direct",
				Branch: run.GetHeadBranch(),
				Files:  changes,
			}
		}

		out = append(out, crash)
	}

	_ = writeJSON("crashes.json", out)
	return out, nil
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

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err == nil {
		var out []string
		for _, f := range zr.File {
			rc, _ := f.Open()
			b, _ := io.ReadAll(rc)
			rc.Close()
			out = append(out, tailLines(string(b), 50))
		}
		return strings.Join(out, "\n---\n"), nil
	}

	return tailLines(string(body), 50), nil
}

func tailLines(s string, n int) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) <= n {
		return s
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}

func cleanANSI(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
}
