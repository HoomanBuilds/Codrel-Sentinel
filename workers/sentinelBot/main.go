package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/confluentinc/confluent-kafka-go/kafka"
)

type PREvent struct {
	Owner    string `json:"owner"`
	Repo     string `json:"repo"`
	PRNumber int    `json:"pr_number"`
	AccessToken string `json:"access_token"`
}

func g() {
	brokers := os.Getenv("KAFKA_BROKERS")
	topic := os.Getenv("KAFKA_TOPIC")

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          "pr-worker",
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer c.Close()

	c.SubscribeTopics([]string{topic}, nil)
	log.Println("worker listening...")

	for {
		msg, err := c.ReadMessage(-1)
		if err != nil {
			log.Println(err)
			continue
		}

		var ev PREvent
		if err := json.Unmarshal(msg.Value, &ev); err != nil {
			log.Println("bad payload:", err)
			continue
		}

		go HandlePREvent(ev, ev.AccessToken)
	}
}
