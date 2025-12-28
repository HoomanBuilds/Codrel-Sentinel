package kafka

import (
	"codrel-sentinel/workers/ingestion-worker/config"
	"codrel-sentinel/workers/ingestion-worker/model"
	"encoding/json"

	"github.com/confluentinc/confluent-kafka-go/kafka"
)

func NewConsumer() (*kafka.Consumer, error) {
	return kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": config.BootstrapServers,
		"group.id":          config.ConsumerGroup,
		"auto.offset.reset": "earliest",
	})
}

func ReadIngestRequest(msg *kafka.Message) (*model.IngestRequest, error) {
	var req model.IngestRequest
	err := json.Unmarshal(msg.Value, &req)
	return &req, err
}
