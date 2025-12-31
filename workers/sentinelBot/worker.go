package main

import (
	"context"
	"log"

	"github.com/google/go-github/v61/github"
	"golang.org/x/oauth2"
)

type ChangedFile struct {
	Path  string
	Patch string
}

type RiskRequest struct {
	Repo   string   `json:"repo"`
	Files  []string `json:"files"`
	Change string   `json:"change"`
}

type RiskResponse struct {
	Results []struct {
		FilePath string  `json:"file_path"`
		Tier     string  `json:"tier"`
		Score    float64 `json:"risk_score"`
		Context  string  `json:"context"`
	} `json:"results"`
}

func githubClient(token string) *github.Client {
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	tc := oauth2.NewClient(context.Background(), ts)
	return github.NewClient(tc)
}

func HandlePREvent(ctx context.Context, ev PREvent, token string) {
	log.Printf("⚡ [Start] Handling PR Event for %s/%s #%d", ev.Owner, ev.Repo, ev.PRNumber)

	client := githubClient(token)

	log.Println("🔍 Fetching PR details from GitHub...")
	pr, _, err := client.PullRequests.Get(ctx, ev.Owner, ev.Repo, ev.PRNumber)
	if err != nil {
		log.Printf("❌ [Error] Fetch PR failed: %v", err)
		return
	}
	log.Printf("✅ PR Fetched: %q (State: %s)", pr.GetTitle(), pr.GetState())

	log.Println("📂 Fetching changed files...")
	files, err := fetchPRFiles(ctx, client, ev)
	if err != nil {
		log.Printf("❌ [Error] Fetch files failed: %v", err)
		return
	}
	log.Printf("✅ Found %d changed files", len(files))

	changedFiles := files

	criticalFiles := selectCriticalFiles(files)
	log.Printf("🎯 Selected %d critical files for deep analysis", len(criticalFiles))
	
	changeSummary := buildChangeSummary(pr, files)

	log.Println("💬 Posting 'Running analysis' status comment...")
	commentID, err := postOrUpdateComment(
		ctx,
		client,
		ev,
		"⏳ Running automated risk analysis...",
		0,
	)
	if err != nil {
		log.Printf("❌ [Error] Comment create failed: %v", err)
		return
	}
	log.Printf("✅ Status comment posted (ID: %d)", commentID)

	log.Println("📡 Calling Risk Analysis API...")
	riskResponse, err := callRiskAPI(ev, criticalFiles, changeSummary)
	if err != nil {
		log.Printf("❌ [Error] Risk API failed: %v", err)
		updateComment(ctx, client, ev, commentID, "❌ Risk analysis failed (Internal Error).")
		return
	}
	log.Printf("✅ Risk API response received (Items: %d)", len(riskResponse.Results))

	diffMap := make(map[string]string)
	for _, f := range files {
		diffMap[f.Path] = f.Patch
	}

	log.Println("🤖 Generating AI prompt...")
	prompt := buildPrompt(
		ev.Owner+"/"+ev.Repo,
		ev.PRNumber,
		pr.GetTitle(),
		pr.GetBody(),
		changedFiles,
		diffMap,
		riskResponse,
	)
	log.Println("✅ Prompt generated successfully")

	log.Println("🧠 Sending prompt to AI Model...")
	finalComment, err := buildFinalComment(prompt)
	if err != nil {
		log.Printf("❌ [Error] AI generation failed: %v", err)
		updateComment(ctx, client, ev, commentID, "❌ Failed to generate AI summary.")
		return
	}

	log.Println("💾 Logging Sentinel Response to Database...")
	go func() {
		dbErr := recordSentinelEvent(ev, finalComment)
		if dbErr != nil {
			log.Printf("❌ [Error] Failed to log DB event: %v", dbErr)
		} else {
			log.Println("✅ DB Event logged successfully")
		}
	}()

	log.Println("✅ AI response generated")

	log.Println("📝 Updating GitHub comment with final report...")
	err = updateComment(ctx, client, ev, commentID, finalComment)
	if err != nil {
		log.Printf("❌ [Error] Failed to update final comment: %v", err)
		return
	}

	log.Printf("🎉 [Done] PR #%d analysis complete!", ev.PRNumber)
}