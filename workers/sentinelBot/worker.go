package main

import (
	"context"
	"log"
	"math/rand"
	"time"

	"github.com/google/go-github/v61/github"
	"golang.org/x/oauth2"
)

func githubClient(token string) *github.Client {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(context.Background(), ts)
	return github.NewClient(tc)
}

func HandlePREvent(ev PREvent , token string) {
	client := githubClient(token)
	ctx := context.Background()

	pr, _, err := client.PullRequests.Get(ctx, ev.Owner, ev.Repo, ev.PRNumber)
	if err != nil {
		log.Println("fetch pr failed:", err)
		return
	}

	log.Printf("PR #%d: %s\n", ev.PRNumber, pr.GetTitle())

	placeholder := "⏳ Processing your PR…"
	_, _, _ = client.Issues.CreateComment(
		ctx,
		ev.Owner,
		ev.Repo,
		ev.PRNumber,
		&github.IssueComment{Body: &placeholder},
	)

	time.Sleep(10 * time.Second)

	images := []string{
		"https://picsum.photos/300",
		"https://placekitten.com/300/300",
		"https://placebear.com/300/300",
	}

	final := "✅ Done.\n\nAutomated analysis complete.\n\n" +
		"![result](" + images[rand.Intn(len(images))] + ")"

	_, _, err = client.Issues.CreateComment(
		ctx,
		ev.Owner,
		ev.Repo,
		ev.PRNumber,
		&github.IssueComment{Body: &final},
	)

	if err != nil {
		log.Println("final comment failed:", err)
	}
}
