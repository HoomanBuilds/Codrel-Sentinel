package model

import (
	"codrel-sentinel/workers/ingestion-worker/github"
)

type IngestRequest struct {
	Repo        string `json:"repo"`
	AccessToken string `json:"access_token"`
	Type        string `json:"type"`
}

type RevertedPRPayload struct {
	Repo     string      `json:"repo"`
	PR       any         `json:"pr"`
	Diff     string      `json:"diff"`
	Comments interface{} `json:"comments"`
}

type RejectedPRPayload struct {
	Repo string `json:"repo"`
	PR   any    `json:"pr"`
}

type BugPayload struct {
	Issues []github.Issue
}

type WorkflowCrashPayload struct {
	Crash []github.MinimalWorkflowFailure
}

type ArchPayload struct {
	Files []github.ArchFile
}