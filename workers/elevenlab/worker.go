package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/joho/godotenv"
)

type Config struct {
	Brokers string
	GroupID string
	Topic   string

	ElevenKey   string
	ElevenVoice string

	TwilioSID   string
	TwilioToken string
	TwilioFrom  string
	Number      string
}

func LoadConfig() Config {
	_ = godotenv.Load()

	return Config{
		Brokers:     os.Getenv("KAFKA_BROKERS"),
		GroupID:     os.Getenv("KAFKA_GROUP_ID"),
		Topic:       os.Getenv("KAFKA_TOPIC"),
		ElevenKey:   os.Getenv("ELEVENLABS_API_KEY"),
		ElevenVoice: os.Getenv("ELEVENLABS_VOICE_ID"),
		TwilioSID:   os.Getenv("TWILIO_SID"),
		TwilioToken: os.Getenv("TWILIO_TOKEN"),
		TwilioFrom:  os.Getenv("TWILIO_FROM"),

		Number: os.Getenv("ALERT_PHONE_NUMBER"),
	}
}

type Job struct {
	EventID  string `json:"eventId"`
	Message  string `json:"message"`
	Priority string `json:"priority"`
}

func StartWorker(cfg Config) error {
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.Brokers,
		"group.id":          cfg.GroupID,
		"auto.offset.reset": "earliest",
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

	log.Println("worker started")

	var wg sync.WaitGroup
	const parallelism = 5

	go func() {
		defer close(jobs)
		for {
			select {
			case <-sig:
				return
			default:
				msg, err := c.ReadMessage(500 * time.Millisecond)
				if err != nil {
					if kafkaErr, ok := err.(kafka.Error); ok && kafkaErr.Code() == kafka.ErrTimedOut {
						continue
					}
					log.Println("kafka error:", err)
					continue
				}
				jobs <- msg

				if err == nil {
					jobs <- msg
				}
			}
		}
	}()

	wg.Add(parallelism)
	for i := 0; i < parallelism; i++ {
		go func(id int) {
			defer wg.Done()
			for msg := range jobs {
				var job Job
				if err := json.Unmarshal(msg.Value, &job); err != nil {
					continue
				}
				if err := HandleJob(cfg, job); err != nil {
					log.Println("job failed:", err)
				}
			}
		}(i)
	}

	<-sig
	wg.Wait()
	return nil
}

func HandleJob(cfg Config, job Job) error {
	audio, err := GenerateSpeech(cfg, job.Message)
	if err != nil {
		return err
	}

	audioURL, err := UploadAudio(job.EventID, audio)
	if err != nil {
		return err
	}

	return CallTwilioRaw(cfg.Number, audioURL)
}

func GenerateSpeech(cfg Config, text string) ([]byte, error) {
	payload := map[string]any{
		"text":     text,
		"model_id": "eleven_multilingual_v2",
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

func UploadAudio(eventId string, audio []byte) (string, error) {
	payload := map[string]any{
		"eventId":     eventId,
		"audioBase64": base64.StdEncoding.EncodeToString(audio),
	}

	b, _ := json.Marshal(payload)

	resp, err := http.Post(
		"https://3000.vinitngr.xyz/api/call-alert/upload-audio",
		"application/json",
		bytes.NewReader(b),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		AudioURL string `json:"audioUrl"`
	}
	json.NewDecoder(resp.Body).Decode(&res)

	return res.AudioURL, nil
}

func CallTwilioRaw(to, audioURL string) error {
	sid := os.Getenv("TWILIO_SID")
	token := os.Getenv("TWILIO_TOKEN")
	from := os.Getenv("TWILIO_FROM")

	twiml := fmt.Sprintf(`<Response><Play>%s</Play></Response>`, audioURL)

	form := url.Values{}
	form.Set("To", to)
	form.Set("From", from)
	form.Set("Twiml", twiml)

	req, err := http.NewRequest(
		"POST",
		fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Calls.json", sid),
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return err
	}

	req.SetBasicAuth(sid, token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("twilio error: %s", b)
	}

	return nil
}
