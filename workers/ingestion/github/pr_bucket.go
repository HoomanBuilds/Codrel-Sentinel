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

type RevertSignal struct {
	Kind       string  `json:"kind"`
	Confidence float32 `json:"confidence"`
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

	SourceBranch string `json:"source_branch"`
	BaseBranch   string `json:"base_branch"`
	
	RejectionReason string `json:"rejection_reason,omitempty"`
	Authorship      string `json:"authorship,omitempty"`

	RevertKind       string  `json:"revert_kind,omitempty"`
	RevertConfidence float32 `json:"revert_confidence,omitempty"`
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
			State:       "closed",
			Sort:        "updated",
			Direction:   "desc",
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
			SourceBranch:   pr.GetHead().GetRef(),
			BaseBranch:     pr.GetBase().GetRef(),
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

		signal, err := detectRevertSignal(ctx, client, owner, repo, pr)
if err != nil {
	return nil, err
}

if pr.ClosedAt == nil {
	continue
}

if signal == nil && pr.ClosedAt.Before(cutoff) {
	continue
}

if signal != nil {

	base.RevertKind = signal.Kind
	base.RevertConfidence = signal.Confidence

	if pr.MergedAt != nil {
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
	}

	out.Reverted = append(out.Reverted, base)
	continue
}

		if pr.MergedAt == nil {

			author := pr.GetUser()
			if author != nil && author.GetType() == "Bot" {
				base.Authorship = "bot"
			} else {
				base.Authorship = "human"
			}

			text := strings.ToLower(base.Title + " " + base.Body)

			switch {
			case base.Authorship == "bot":
				base.RejectionReason = "bot_generated"
			case strings.Contains(text, "rate limit"):
				base.RejectionReason = "rate_limited"
			case strings.Contains(text, "skip review"):
				base.RejectionReason = "review_skipped"
			default:
				base.RejectionReason = "manual"
			}

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

func detectRevertSignal(
	ctx context.Context,
	client *github.Client,
	owner, repo string,
	pr *github.PullRequest,
) (*RevertSignal, error) {

	title := strings.ToLower(pr.GetTitle())
	branch := strings.ToLower(pr.GetHead().GetRef())
	body := strings.ToLower(pr.GetBody())

	if strings.HasPrefix(title, "revert") {
		return &RevertSignal{
			Kind:       "explicit_title",
			Confidence: 1.0,
		}, nil
	}

	commits, _, err := client.PullRequests.ListCommits(
		ctx,
		owner,
		repo,
		pr.GetNumber(),
		&github.ListOptions{PerPage: 30},
	)
	if err != nil {
		return nil, err
	}

	for _, c := range commits {
		msg := strings.ToLower(c.GetCommit().GetMessage())
		if strings.HasPrefix(msg, "revert \"") {
			return &RevertSignal{
				Kind:       "explicit_commit",
				Confidence: 1.0,
			}, nil
		}
	}

	if strings.Contains(branch, "revert") ||
		strings.Contains(branch, "rollback") ||
		strings.Contains(branch, "undo") ||
		strings.Contains(title, "revert") ||
		strings.Contains(title, "rollback") ||
		strings.Contains(title, "undo") {

		return &RevertSignal{
			Kind:       "heuristic",
			Confidence: 0.8,
		}, nil
	}

	score := 0

	if strings.Contains(body, "revert") ||
		strings.Contains(body, "rollback") ||
		strings.Contains(body, "undo") {
		score++
	}

	if pr.GetAdditions() > 0 {
		deletionsRatio := float32(pr.GetDeletions()) / float32(pr.GetAdditions()+pr.GetDeletions())
		if deletionsRatio > 0.7 {
			score++
		}
	}

	if score >= 2 {
		return &RevertSignal{
			Kind:       "contextual",
			Confidence: 0.6,
		}, nil
	}

	return nil, nil
}
