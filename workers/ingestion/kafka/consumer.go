package kafka

import (
	"codrel-sentinel/workers/ingestion-worker/config"
	"codrel-sentinel/workers/ingestion-worker/model"
	"encoding/json"
	"os"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/joho/godotenv"
)

func NewConsumer() (*kafka.Consumer, error) {
	godotenv.Load()
	servers := os.Getenv("KAFKA_BROKER")
	if servers == "" {
		servers = config.BootstrapServers
	}
	return kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": servers,
		"group.id":          config.ConsumerGroup,
		"auto.offset.reset": "earliest",
	})
}

func ReadIngestRequest(msg *kafka.Message) (*model.IngestRequest, error) {
	var req model.IngestRequest
	err := json.Unmarshal(msg.Value, &req)
	return &req, err
}
