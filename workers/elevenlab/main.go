package main

import (
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := LoadConfig()

	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.Brokers,
		"group.id":          cfg.GroupID,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer consumer.Close()

	if err := consumer.SubscribeTopics([]string{cfg.Topic}, nil); err != nil {
		log.Fatal(err)
	}

	log.Println("voice worker consumer started")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-sig:
			log.Println("shutdown")
			return

		default:
			msg, err := consumer.ReadMessage(500 * time.Millisecond)
			if err != nil {
				log.Println("kafka error:", err)
				continue
			}

			var job Job
			if err := json.Unmarshal(msg.Value, &job); err != nil {
				log.Println("bad payload:", err)
				continue
			}

			if err := HandleJob(cfg, job); err != nil {
				log.Println("job failed:", err)
			}
		}
	}
}
