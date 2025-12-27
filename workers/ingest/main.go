package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type FileSignal struct {
	RepoID    string                 `json:"repoId"`
	FilePath  string                 `json:"filePath"`
	Signal    map[string]interface{} `json:"signal"`
	Timestamp int64                  `json:"timestamp"`
}

type FileMeta struct {
	RepoID          string `json:"repoId"`
	FilePath        string `json:"filePath"`
	CIFailures      int    `json:"ciFailures"`
	RevertedPRs     int    `json:"revertedPrs"`
	ChangeFrequency int    `json:"changeFrequency"`
}

var fileMetaStore = make(map[string]*FileMeta)

func main() {
	log.Println("[Ingest Worker] Starting...")
	log.Println("[Ingest Worker] Consuming: codrel.file.signals")
	log.Println("[Ingest Worker] Mode: Mock (no real Kafka)")

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	// Simulate consuming messages
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			mockSignal := FileSignal{
				RepoID:    "repo-1",
				FilePath:  "src/auth/login.ts",
				Signal:    map[string]interface{}{"type": "ci_failure"},
				Timestamp: time.Now().Unix(),
			}
			processSignal(mockSignal)
		}
	}()

	<-sigchan
	log.Println("[Ingest Worker] Shutting down...")
}

func processSignal(signal FileSignal) {
	key := fmt.Sprintf("%s:%s", signal.RepoID, signal.FilePath)

	meta, exists := fileMetaStore[key]
	if !exists {
		meta = &FileMeta{
			RepoID:   signal.RepoID,
			FilePath: signal.FilePath,
		}
		fileMetaStore[key] = meta
	}

	if signalType, ok := signal.Signal["type"].(string); ok {
		switch signalType {
		case "ci_failure":
			meta.CIFailures++
		case "pr_reverted":
			meta.RevertedPRs++
		}
	}
	meta.ChangeFrequency++

	data, _ := json.Marshal(meta)
	log.Printf("[Ingest Worker] Updated metadata: %s", string(data))
}
