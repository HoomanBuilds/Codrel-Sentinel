package config

const (
	BootstrapServers = "kafka:29092"

	AnalysisTopic = "repo.analysis.ai"
	RequestTopic  = "repo.analysis.request"

	ConsumerGroup = "go-ingest-worker"
)
