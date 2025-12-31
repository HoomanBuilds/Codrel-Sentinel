package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/time/rate"

	ckafka "github.com/confluentinc/confluent-kafka-go/kafka"

	"codrel-sentinel/workers/ingestion-worker/config"
	"codrel-sentinel/workers/ingestion-worker/db"
	"codrel-sentinel/workers/ingestion-worker/github"
	"codrel-sentinel/workers/ingestion-worker/kafka"
	"codrel-sentinel/workers/ingestion-worker/model"
)

const (
	parallelism = 2
	jobBuffer   = 100
)

var githubLimiter = rate.NewLimiter(2, 4)

var outTopic = config.AnalysisTopic

type AnalysisEnvelope struct {
	Repo string `json:"repo"`

	WorkflowCrash *model.WorkflowCrashPayload `json:"workflow_crash"`
	Bug           *model.BugPayload           `json:"bug"`
	Rule          *model.ArchPayload          `json:"rule"`

	RevertedPRs []model.RevertedPRPayload `json:"reverted_prs"`
	RejectedPRs []model.RejectedPRPayload `json:"rejected_prs"`
}

func main() {
	db.InitDB()
	consumer, err := kafka.NewConsumer()
	if err != nil {
		panic(err)
	}
	defer consumer.Close()

	producer, err := kafka.NewProducer()
	if err != nil {
		panic(err)
	}
	defer producer.Close()

	if err := consumer.Subscribe(config.RequestTopic, nil); err != nil {
		panic(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	jobs := make(chan *ckafka.Message, jobBuffer)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)

	log.Println("ingestion worker started")

	go func() {
		defer close(jobs)
		for {
			select {
			case <-ctx.Done():
				log.Println("poll loop stopping")
				return
			default:
				msg, err := consumer.ReadMessage(500 * time.Millisecond)
				if err == nil {
					jobs <- msg
				}
			}
		}
	}()

	var wg sync.WaitGroup
	wg.Add(parallelism)

	for i := 0; i < parallelism; i++ {
		go worker(ctx, &wg, jobs, producer)
	}

	<-sig
	log.Println("shutdown signal received")
	cancel()

	wg.Wait()
	producer.Flush(5000)
	log.Println("all workers stopped")
}

func worker(
	ctx context.Context,
	wg *sync.WaitGroup,
	jobs <-chan *ckafka.Message,
	producer *ckafka.Producer,
) {
	defer wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-jobs:
			if !ok {
				return
			}
			processMessage(ctx, msg, producer)
		}
	}
}
func processMessage(
	ctx context.Context,
	msg *ckafka.Message,
	producer *ckafka.Producer,
) {
	req, err := kafka.ReadIngestRequest(msg)
	if err != nil {
		log.Println("invalid request:", err)
		return
	}

	parts := strings.Split(req.Repo, "/")
	if len(parts) != 2 {
		db.UpdateStatus(req.Repo, "FAILED")
		log.Println("invalid repo:", req.Repo)
		return
	}

	client := github.NewClient(req.AccessToken)

	switch req.Type {
	case "sync":
		log.Println("syning repo:", req.Repo)
		log.Printf("[sync] received sync request for %s - skipping for now", req.Repo)
		return
	case "connection":
		log.Println("processing repo:", req.Repo)

		// webhookURL := os.Getenv("BACKEND_WEBHOOK_URL")
		// webhookSecret := os.Getenv("GITHUB_WEBHOOK_SECRET")
		// log.Printf(":setting webhook %s for repo %s", webhookURL, req.Repo)

		// if webhookURL != "" {
		// 	err := github.SetupRepoWebhook(client, req.AccessToken, req.Repo, webhookURL, webhookSecret)
		// 	if err != nil {
		// 		log.Printf("[setup] webhook failed (critical): %v", err)
		// 	}
		// }

		db.UpdateStatus(req.Repo, "FETCHING")
		envelope := AnalysisEnvelope{
			Repo: req.Repo,
		}

		var stages sync.WaitGroup
		var mu sync.Mutex

		stages.Add(3)

		go func() {
			defer stages.Done()
			mu.Lock()
			envelope.WorkflowCrash = ProcessWorkflowCrash(req, req.AccessToken, parts[0], parts[1])
			mu.Unlock()
		}()

		go func() {
			defer stages.Done()
			mu.Lock()
			envelope.Bug = ProcessBug(req, req.AccessToken, parts[0], parts[1])
			mu.Unlock()
		}()

		go func() {
			defer stages.Done()
			files, err := github.FetchRepoArchitecture(client, parts[0], parts[1])
			if err != nil {
				log.Println("fetch repo architecture failed:", err)
				return
			}
			mu.Lock()
			envelope.Rule = &model.ArchPayload{Files: files}
			mu.Unlock()
		}()

		if err := githubLimiter.Wait(ctx); err != nil {
			db.UpdateStatus(req.Repo, "FAILED")
			log.Println("rate limiter cancelled")
			return
		}

		prBuckets, err := github.FetchClosedPRBuckets(
			client,
			parts[0],
			parts[1],
		)
		if err != nil {
			db.UpdateStatus(req.Repo, "FAILED")
			log.Println("github fetch failed:", err)
			return
		}

		reverted := prBuckets.Reverted
		rejected := prBuckets.Rejected

		var buildWG sync.WaitGroup
		buildWG.Add(2)

		go func() {
			defer buildWG.Done()
			if len(reverted) == 0 {
				return
			}

			res := make([]model.RevertedPRPayload, 0, len(reverted))
			for _, pr := range reverted {
				res = append(res,
					model.RevertedPRPayload{
						Repo:     req.Repo,
						PR:       pr,
						Diff:     pr.Diff,
						Comments: pr.Body,
					},
				)
			}
			mu.Lock()
			envelope.RevertedPRs = res
			mu.Unlock()
		}()

		go func() {
			defer buildWG.Done()
			if len(rejected) == 0 {
				return
			}

			res := make([]model.RejectedPRPayload, 0, len(rejected))
			for _, pr := range rejected {
				res = append(res,
					model.RejectedPRPayload{
						Repo: req.Repo,
						PR:   pr,
					},
				)
			}
			mu.Lock()
			envelope.RejectedPRs = res
			mu.Unlock()
		}()

		buildWG.Wait()
		stages.Wait()

		b, err := json.MarshalIndent(envelope, "", "  ")
		if err != nil {
			log.Println("marshal failed:", err)
			db.UpdateStatus(req.Repo, "FAILED")
			return
		}

		err = os.WriteFile("result.json", b, 0644)
		log.Println("wrote result.json")

		log.Printf("repo fetch completed for : %s", req.Repo)
		if err := emitEnvelope(producer, envelope); err != nil {
			log.Printf("❌ Failed to emit to Kafka: %v", err)
			db.UpdateStatus(req.Repo, "FAILED")
			return
		}

		db.UpdateStatus(req.Repo, "QUEUED")
	default:
		log.Printf("unknown request type: %s", req.Type)
	}
}
func emitEnvelope(
    producer *ckafka.Producer,
    envelope AnalysisEnvelope,
) error {
    bytes, err := json.Marshal(envelope)
    if err != nil {
        return err
    }

    payloadSize := len(bytes)
    log.Printf("📦 Payload size: %d bytes (%.2f MB)", payloadSize, float64(payloadSize)/1024/1024)

    if payloadSize > 1000000 {
        log.Println("⚠️ WARNING: Payload is close to or over the default Kafka 1MB limit!")
    }

    deliveryChan := make(chan ckafka.Event)

    err = producer.Produce(&ckafka.Message{
        TopicPartition: ckafka.TopicPartition{
            Topic:     &outTopic,
            Partition: ckafka.PartitionAny,
        },
        Value: bytes,
    }, deliveryChan)

    if err != nil {
        return err
    }

    e := <-deliveryChan
    m := e.(*ckafka.Message)
    
    close(deliveryChan)

    if m.TopicPartition.Error != nil {
        log.Printf("❌ Kafka Delivery Failed: %v", m.TopicPartition.Error)
        return m.TopicPartition.Error
    }

    log.Printf("✅ Message delivered to topic %s [%d] at offset %v",
        *m.TopicPartition.Topic, m.TopicPartition.Partition, m.TopicPartition.Offset)

    return nil
}

func ProcessWorkflowCrash(
	req *model.IngestRequest,
	token string,
	owner string,
	repo string,
) *model.WorkflowCrashPayload {
	log.Println("ProcessWorkflowCrash:", req.Repo)

	crashes, err := github.FetchWorkflowFailures(
		github.NewClient(token),
		owner,
		repo,
	)
	if err != nil {
		log.Println("[worker] workflow crash fetch failed:", err)
		return &model.WorkflowCrashPayload{
			Crash: []github.WorkflowCrash{},
		}
	}

	return &model.WorkflowCrashPayload{
		Crash: crashes,
	}
}

func ProcessBug(req *model.IngestRequest, token string, owner string, repo string) *model.BugPayload {
	log.Println("ProcessBug:", req.Repo)

	issues, err := github.FetchClosedIssuesRaw(
		token,
		owner,
		repo,
	)
	if err != nil {
		log.Println("fetch failed:", err)
		return &model.BugPayload{}
	}

	return &model.BugPayload{
		Issues: issues,
	}
}

func ProcessArchitecture(
	req *model.IngestRequest,
	token string,
	owner string,
	repo string,
) *model.ArchPayload {
	log.Println("ProcessArchitecture:", req.Repo)

	files, err := github.FetchRepoArchitecture(github.NewClient(token), owner, repo)
	if err != nil {
		log.Println("arch fetch failed:", err)
		return &model.ArchPayload{}
	}

	return &model.ArchPayload{
		Files: files,
	}
}
