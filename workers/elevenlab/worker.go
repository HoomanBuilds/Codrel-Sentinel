package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/joho/godotenv"
	"sync"
)

type Config struct {
	Brokers string
	GroupID string
	Topic   string

	ElevenKey   string
	ElevenVoice string
	OutputDir   string
}

func LoadConfig() Config {
	_ = godotenv.Load()

	return Config{
		Brokers:     os.Getenv("KAFKA_BROKERS"),
		GroupID:     os.Getenv("KAFKA_GROUP_ID"),
		Topic:       os.Getenv("KAFKA_TOPIC"),
		ElevenKey:   os.Getenv("ELEVENLABS_API_KEY"),
		ElevenVoice: os.Getenv("ELEVENLABS_VOICE_ID"),
		OutputDir:   "./generation",
	}
}

type Job struct {
	EventID  string `json:"eventId"`
	Message  string `json:"message"`
	Priority string `json:"priority"`
}


func StartWorker(cfg Config) error {
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":   cfg.Brokers,
		"group.id":            cfg.GroupID,
		"auto.offset.reset":   "earliest",
		"security.protocol":   "PLAINTEXT",
		"api.version.request": true,
	})
	if err != nil {
		return err
	}
	defer c.Close()

	if err := c.Subscribe(cfg.Topic, nil); err != nil {
		return err
	}

	jobs := make(chan *kafka.Message, 100)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)

	log.Println("elevenlabs worker started")

	var wg sync.WaitGroup
	const parallelism = 5

	go func() {
		defer close(jobs)

		for {
			select {
			case <-sig:
				log.Println("poll loop stopping")
				return
			default:
				msg, err := c.ReadMessage(500 * time.Millisecond)
				if err != nil {
					continue
				}
				jobs <- msg
			}
		}
	}()

	wg.Add(parallelism)
	for i := 1; i <= parallelism; i++ {
		go func(id int) {
			defer wg.Done()
			for msg := range jobs {
				fmt.Printf("worker %d processing: %s\n", id, string(msg.Value))

				var job Job
				if err := json.Unmarshal(msg.Value, &job); err != nil {
					log.Println("bad message:", err)
					continue
				}
				HandleJob(cfg, job)
				time.Sleep(2 * time.Second)
			}
			fmt.Printf("worker %d exiting\n", id)
		}(i)
	}

	<-sig
	log.Println("shutdown signal received")

	wg.Wait()
	log.Println("all workers stopped")

	return nil
}

func HandleJob(cfg Config, job Job) error {
	text := string(job.Message)

	audio, err := GenerateSpeech(cfg, text)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(cfg.OutputDir, 0755); err != nil {
		return err
	}

	out := filepath.Join(cfg.OutputDir, fmt.Sprintf("%s.mp3", job.EventID))
	return os.WriteFile(out, audio, 0644)
}

func GenerateSpeech(cfg Config, text string) ([]byte, error) {
	payload := map[string]any{
		"text":     text,
		"model_id": "eleven_multilingual_v2",
		"voice_settings": map[string]any{
		"stability":        0.25,
		"similarity_boost": 0.7,
		"style":            0.8,
		"use_speaker_boost": true,
	},
	}

	b, _ := json.Marshal(payload)

	req, _ := http.NewRequest(
		"POST",
		fmt.Sprintf("https://api.elevenlabs.io/v1/text-to-speech/%s", cfg.ElevenVoice),
		bytes.NewReader(b),
	)

	req.Header.Set("xi-api-key", cfg.ElevenKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("elevenlabs error: %s", body)
	}

	return io.ReadAll(resp.Body)
}
