package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/joho/godotenv"
)

type PREvent struct {
	Owner       string `json:"owner"`
	Repo        string `json:"repo"`
	PRNumber    int    `json:"pr_number"`
	AccessToken string `json:"access_token"`
}

func main() {
	_ = godotenv.Load()

	// Use helper to allow defaults (prevents crash if env is missing)
	brokers := getenv("KAFKA_BROKERS", "localhost:9092")
	topic := "sentinelbot.events"
	groupID := "pr-worker-v2"

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          groupID,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		log.Fatal("Failed to create consumer:", err)
	}
	// 1. IMPROVEMENT: Close connection cleanly on exit
	defer c.Close()

	// 2. IMPROVEMENT: Check if subscription actually worked
	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		log.Fatalf("Failed to subscribe to topic %s: %v", topic, err)
	}

	log.Printf("✅ Worker started. Listening on %s...", topic)

	// 3. IMPROVEMENT: Handle Ctrl+C (SIGINT) gracefully
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	run := true
	for run {
		select {
		case <-sig:
			log.Println("🔻 Shutdown signal received. Closing worker...")
			run = false
		default:
			// Read message with a short timeout (100ms) so we can check the signal loop
			msg, err := c.ReadMessage(1000) // Wait 1s
			if err != nil {
				// Ignore timeout errors (just means no new data)
				if err.(kafka.Error).Code() == kafka.ErrTimedOut {
					continue
				}
				log.Println("❌ Read error:", err)
				continue
			}

			// Process Message
			log.Printf("📩 Received PR Event: Partition %d | Offset %d", 
				msg.TopicPartition.Partition, msg.TopicPartition.Offset)

			var ev PREvent
			if err := json.Unmarshal(msg.Value, &ev); err != nil {
				log.Println("⚠️ Bad payload:", err)
				continue
			}

			// Trigger Async Handler
			go HandlePREvent(context.Background(), ev, ev.AccessToken)
		}
	}
}

// Helper for default env vars
func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}