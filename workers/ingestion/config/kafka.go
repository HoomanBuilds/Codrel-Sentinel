package config

const (
	BootstrapServers = "localhost:9092"

	AnalysisTopic = "repo.analysis.ai"
	RequestTopic  = "repo.analysis.request"

	ConsumerGroup = "go-ingest-worker"
)
