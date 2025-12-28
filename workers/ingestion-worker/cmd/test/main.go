
package main

import (
	"log"
	"os"
	"strings"

	"codrel-sentinel/workers/ingestion-worker/auth"
	"codrel-sentinel/workers/ingestion-worker/github"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	appID := os.Getenv("GITHUB_APP_ID")
	repo := os.Getenv("REPO")
	privateKeyPath := os.Getenv("GITHUB_PRIVATE_KEY_PATH")

	if appID == "" || repo == "" || privateKeyPath == "" {
		log.Fatal("set GITHUB_APP_ID, REPO, GITHUB_PRIVATE_KEY_PATH")
	}

	parts := strings.Split(repo, "/")
	if len(parts) != 2 {
		log.Fatal("REPO must be owner/repo")
	}
	owner, repoName := parts[0], parts[1]

	app, err := auth.NewGitHubApp(appID, privateKeyPath)
	if err != nil {
		log.Fatalf("failed to load github app: %v", err)
	}

	token, err := app.GetInstallationToken(owner, repoName)
	if err != nil {
		log.Fatalf("failed to get installation token: %v", err)
	}

	log.Println("[auth] installation token acquired")

	// client := github.NewClient(token)

	// ==========================================================
	// 1. PR BUCKETS (REVERTED/REJECTED) - COMMENTED OUT
	// ==========================================================
	/*
		p, err := github.FetchClosedPRBuckets(client, owner, repoName)
		if err != nil {
			log.Fatal(err)
		}

		log.Printf("[ingest] DONE. reverted PRs=%d , rejected PRs=%d", len(p.Reverted), len(p.Rejected))
	*/

	// ==========================================================
	// 2. KNOWN BUGS INGESTION
	// ==========================================================
	// bugs, err := github.FetchClosedIssuesRaw(client, owner, repoName)
	// if err != nil {
	// 	log.Fatal(err)
	// }
	issues , err := github.FetchClosedIssuesRaw(token , owner, repoName)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("[ingest] DONE. Found qualified bugs =%d", len(issues))
}