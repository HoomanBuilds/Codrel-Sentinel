package main

import (
	"context"
	"strings"

	"github.com/google/go-github/v61/github"
)



func fetchPRFiles(
	ctx context.Context,
	client *github.Client,
	ev PREvent,
) ([]ChangedFile, error) {

	var all []ChangedFile
	opt := &github.ListOptions{PerPage: 100}

	for {
		files, resp, err := client.PullRequests.ListFiles(
			ctx,
			ev.Owner,
			ev.Repo,
			ev.PRNumber,
			opt,
		)
		if err != nil {
			return nil, err
		}

		for _, f := range files {
			all = append(all, ChangedFile{
				Path:  f.GetFilename(),
				Patch: f.GetPatch(),
			})
		}

		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}

	return all, nil
}

func selectCriticalFiles(files []ChangedFile) []string {
	if len(files) <= 10 {
		return extractPaths(files)
	}

	var critical []string
	for _, f := range files {
		if strings.Contains(f.Path, "Dockerfile") ||
			strings.HasSuffix(f.Path, ".ts") ||
			strings.HasSuffix(f.Path, ".go") ||
			strings.HasSuffix(f.Path, ".js") ||
			strings.HasSuffix(f.Path, ".json") {
			critical = append(critical, f.Path)
		}
		if len(critical) >= 5 {
			break
		}
	}

	return critical
}

func extractPaths(files []ChangedFile) []string {
	out := make([]string, 0, len(files))
	for _, f := range files {
		out = append(out, f.Path)
	}
	return out
}


func postOrUpdateComment(
	ctx context.Context,
	client *github.Client,
	ev PREvent,
	body string,
	existingID int64,
) (int64, error) {

	if existingID != 0 {
		c, _, err := client.Issues.EditComment(
			ctx,
			ev.Owner,
			ev.Repo,
			existingID,
			&github.IssueComment{Body: &body},
		)
		return c.GetID(), err
	}

	c, _, err := client.Issues.CreateComment(
		ctx,
		ev.Owner,
		ev.Repo,
		ev.PRNumber,
		&github.IssueComment{Body: &body},
	)
	if err != nil {
		return 0, err
	}
	return c.GetID(), nil
}

func updateComment(
	ctx context.Context,
	client *github.Client,
	ev PREvent,
	id int64,
	body string,
) error {
	_, _, err := client.Issues.EditComment(
		ctx,
		ev.Owner,
		ev.Repo,
		id,
		&github.IssueComment{Body: &body},
	)
	return err
}
