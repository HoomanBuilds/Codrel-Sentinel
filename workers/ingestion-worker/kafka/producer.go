package kafka

import (
	"encoding/json"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"codrel-sentinel/workers/ingestion-worker/config"
	"codrel-sentinel/workers/ingestion-worker/model"
)

func NewProducer() (*kafka.Producer, error) {
	return kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": config.BootstrapServers,
	})
}

func ProduceRevertedPR(
	producer *kafka.Producer,
	payload model.RevertedPRPayload,
) error {

	data, _ := json.Marshal(payload)

	topic := config.RevertedTopic
	return producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Value: data,
	}, nil)
}

func ProduceRejectedPR(
	producer *kafka.Producer,
	payload model.RejectedPRPayload,
) error {

	data, _ := json.Marshal(payload)

	topic := config.RejectedTopic
	return producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Value: data,
	}, nil)
}
