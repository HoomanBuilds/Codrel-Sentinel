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
	defer c.Close()

	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		log.Fatalf("Failed to subscribe to topic %s: %v", topic, err)
	}

	log.Printf("✅ Worker started. Listening on %s...", topic)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	run := true
	for run {
		select {
		case <-sig:
			log.Println("🔻 Shutdown signal received. Closing worker...")
			run = false
		default:
			msg, err := c.ReadMessage(1000)
			if err != nil {
				if err.(kafka.Error).Code() == kafka.ErrTimedOut {
					continue
				}
				log.Println("❌ Read error:", err)
				continue
			}

			log.Printf("📩 Received PR Event: Partition %d | Offset %d", 
				msg.TopicPartition.Partition, msg.TopicPartition.Offset)

			var ev PREvent
			if err := json.Unmarshal(msg.Value, &ev); err != nil {
				log.Println("⚠️ Bad payload:", err)
				continue
			}

			go HandlePREvent(context.Background(), ev, ev.AccessToken)
		}
	}
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}