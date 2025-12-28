package github

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/go-github/v61/github"
)

const ENABLE_COMMENTS = true

type PRBuckets struct {
	Reverted []MinimalPR `json:"reverted"`
	Rejected []MinimalPR `json:"rejected"`
}

type MinimalComment struct {
	Author     string    `json:"author"`
	AuthorType string    `json:"author_type"`
	IsBot      bool      `json:"is_bot"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
}

type MinimalPR struct {
	Number         int              `json:"number"`
	Title          string           `json:"title"`
	Body           string           `json:"body"`
	CreatedAt      time.Time        `json:"created_at"`
	MergedAt       *time.Time       `json:"merged_at,omitempty"`
	MergeCommitSHA string           `json:"merge_commit_sha,omitempty"`
	HTMLURL        string           `json:"html_url"`
	Diff           string           `json:"diff,omitempty"`
	Comments       []MinimalComment `json:"comments,omitempty"`
}

func FetchClosedPRBuckets(
	client *github.Client,
	owner string,
	repo string,
) (*PRBuckets, error) {

	ctx := context.Background()
	cutoff := time.Now().AddDate(0, -3, 0)

	log.Printf("[ingest] fetching closed PRs for %s/%s", owner, repo)

	prs, _, err := client.PullRequests.List(
		ctx,
		owner,
		repo,
		&github.PullRequestListOptions{
			State:     "closed",
			Sort:      "updated",
			Direction: "desc",
			ListOptions: github.ListOptions{PerPage: 50},
		},
	)
	if err != nil {
		return nil, err
	}

	out := &PRBuckets{
		Reverted: []MinimalPR{},
		Rejected: []MinimalPR{},
	}

	for _, pr := range prs {
		if pr.ClosedAt == nil || pr.ClosedAt.Before(cutoff) {
			continue
		}

		title := pr.GetTitle()
		var mergedAt *time.Time
		if pr.MergedAt != nil {
			mergedAt = &pr.MergedAt.Time
		}

		base := MinimalPR{
			Number:         pr.GetNumber(),
			Title:          title,
			Body:           pr.GetBody(),
			CreatedAt:      pr.GetCreatedAt().Time,
			MergedAt:       mergedAt,
			MergeCommitSHA: pr.GetMergeCommitSHA(),
			HTMLURL:        pr.GetHTMLURL(),
		}

		if ENABLE_COMMENTS {
			var comments []MinimalComment

			issueComments, _, err := client.Issues.ListComments(
				ctx,
				owner,
				repo,
				pr.GetNumber(),
				&github.IssueListCommentsOptions{
					ListOptions: github.ListOptions{PerPage: 30},
				},
			)
			if err != nil {
				return nil, err
			}

			for _, c := range issueComments {
				u := c.GetUser()
				isBot := u.GetType() == "Bot"

				comments = append(comments, MinimalComment{
					Author:     u.GetLogin(),
					AuthorType: map[bool]string{true: "bot", false: "human"}[isBot],
					IsBot:      isBot,
					Body:       c.GetBody(),
					CreatedAt:  c.GetCreatedAt().Time,
				})
			}

			reviewComments, _, err := client.PullRequests.ListComments(
				ctx,
				owner,
				repo,
				pr.GetNumber(),
				&github.PullRequestListCommentsOptions{
					ListOptions: github.ListOptions{PerPage: 30},
				},
			)
			if err != nil {
				return nil, err
			}

			for _, c := range reviewComments {
				u := c.GetUser()
				isBot := u.GetType() == "Bot"

				comments = append(comments, MinimalComment{
					Author:     u.GetLogin(),
					AuthorType: map[bool]string{true: "bot", false: "human"}[isBot],
					IsBot:      isBot,
					Body:       c.GetBody(),
					CreatedAt:  c.GetCreatedAt().Time,
				})
			}

			base.Comments = comments
		}

		isRevert, err := isRevertPR(ctx, client, owner, repo, pr)
			if err != nil {
				return nil, err
			}

			if pr.MergedAt != nil && isRevert {
			diff, _, err := client.PullRequests.GetRaw(
				ctx,
				owner,
				repo,
				pr.GetNumber(),
				github.RawOptions{Type: github.Diff},
			)
			if err != nil {
				return nil, err
			}

			base.Diff = diff
			out.Reverted = append(out.Reverted, base)
			continue
		}

		if pr.MergedAt == nil {
			out.Rejected = append(out.Rejected, base)
		}
	}

	log.Printf(
		"[ingest] completed | reverted=%d rejected=%d",
		len(out.Reverted),
		len(out.Rejected),
	)

	_ = writeJSON("reverted.json", out.Reverted)
	_ = writeJSON("rejected.json", out.Rejected)

	return out, nil
}

func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func isRevertPR(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	pr *github.PullRequest,
) (bool, error) {

	title := strings.ToLower(pr.GetTitle())
	if strings.HasPrefix(title, "revert") ||
		strings.Contains(title, "rollback") ||
		strings.Contains(title, "undo") {
		return true, nil
	}

	commits, _, err := client.PullRequests.ListCommits(
		ctx,
		owner,
		repo,
		pr.GetNumber(),
		&github.ListOptions{PerPage: 30},
	)
	if err != nil {
		return false, err
	}

	for _, c := range commits {
		msg := strings.ToLower(c.GetCommit().GetMessage())
		if strings.HasPrefix(msg, "revert \"") {
			return true, nil
		}
	}

	return false, nil
}
