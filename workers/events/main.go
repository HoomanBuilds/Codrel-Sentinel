package main

import (
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type RiskAssessment struct {
	RiskScore   float64  `json:"riskScore"`
	Decision    string   `json:"decision"`
	Reasons     []string `json:"reasons"`
	EvidenceIDs []string `json:"evidenceIds,omitempty"`
}

type RiskEvent struct {
	EventID    string         `json:"eventId"`
	RepoID     string         `json:"repoId"`
	Assessment RiskAssessment `json:"assessment"`
	Timestamp  int64          `json:"timestamp"`
}

type DatadogMetric struct {
	Name  string            `json:"name"`
	Value float64           `json:"value"`
	Tags  map[string]string `json:"tags"`
}

func main() {
	log.Println("[Events Worker] Starting...")
	log.Println("[Events Worker] Consuming: codrel.risk.events")
	log.Println("[Events Worker] Producing: Datadog metrics")
	log.Println("[Events Worker] Mode: Mock")

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		ticker := time.NewTicker(8 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			mockEvent := RiskEvent{
				EventID: "evt-mock-001",
				RepoID:  "repo-1",
				Assessment: RiskAssessment{
					RiskScore: 0.65,
					Decision:  "warn",
					Reasons:   []string{"Critical path: auth/"},
				},
				Timestamp: time.Now().Unix(),
			}
			processRiskEvent(mockEvent)
		}
	}()

	<-sigchan
	log.Println("[Events Worker] Shutting down...")
}

func processRiskEvent(event RiskEvent) {
	data, _ := json.Marshal(event)
	log.Printf("[Events Worker] Received: %s", string(data))

	emitDatadogMetric(DatadogMetric{
		Name:  "sentinel.risk_score",
		Value: event.Assessment.RiskScore,
		Tags:  map[string]string{"repo_id": event.RepoID, "decision": event.Assessment.Decision},
	})

	if event.Assessment.Decision == "block" {
		emitDatadogMetric(DatadogMetric{
			Name:  "sentinel.blocked_changes",
			Value: 1,
			Tags:  map[string]string{"repo_id": event.RepoID},
		})
		log.Printf("[Events Worker] ALERT: Blocked change in %s", event.RepoID)
	}
}

func emitDatadogMetric(metric DatadogMetric) {
	data, _ := json.Marshal(metric)
	log.Printf("[Datadog Emit] %s", string(data))
}
