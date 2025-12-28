package config

const (
	BootstrapServers = "localhost:9092"

	RequestTopic  = "repo.ingest.request"
	RevertedTopic = "repo.ingest.reverted"

	AnalysisStorageTopic = "repo.analysis.connection"
	RejectedTopic = "repo.ingest.rejected"
	ConsumerGroup = "go-ingest-worker"
)
