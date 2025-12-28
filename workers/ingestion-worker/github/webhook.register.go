package github

import (
	"context"
	"log"
	"strings"

	"github.com/google/go-github/v61/github"
)

func SetupRepoWebhook(client *github.Client, owner, repo, targetURL, secret string) error {
	ctx := context.Background()

	config := &github.HookConfig{
		URL:         github.String(targetURL),
		ContentType: github.String("json"),
		Secret:      github.String(secret),
		InsecureSSL: github.String("0"),
	}

	hook := &github.Hook{
		Active: github.Bool(true),
		Events: []string{
			"push",
			"pull_request",
			"workflow_run",
			"issues",
		},
		Config: config,
	}

	log.Printf("[setup] registering webhook: %s", targetURL)

	_, _, err := client.Repositories.CreateHook(ctx, owner, repo, hook)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already exists") {
			log.Printf("[setup] webhook already exists, skipping...")
			return nil
		}
		return err
	}

	return nil
}