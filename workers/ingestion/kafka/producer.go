package kafka

import (
	"github.com/confluentinc/confluent-kafka-go/kafka"
	"codrel-sentinel/workers/ingestion-worker/config"
)

func NewProducer() (*kafka.Producer, error) {
	return kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": config.BootstrapServers,
	})
}
