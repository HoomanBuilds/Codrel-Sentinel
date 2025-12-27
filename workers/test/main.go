package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	brokers := getenv("KAFKA_BROKERS", "localhost:9092")
	topic := getenv("KAFKA_TOPIC", "codrel.index.jobs")
	group := getenv("KAFKA_GROUP", "codrel-test-consumer")

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          group,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer c.Close()

	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		log.Fatal(err)
	}

	log.Println("consumer started")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-sig:
			log.Println("shutdown")
			return
		default:
			msg, err := c.ReadMessage(-1)
			if err != nil {
				log.Println("error:", err)
				continue
			}
			log.Printf(
				"topic=%s partition=%d offset=%d value=%s\n",
				*msg.TopicPartition.Topic,
				msg.TopicPartition.Partition,
				msg.TopicPartition.Offset,
				string(msg.Value),
			)
		}
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
