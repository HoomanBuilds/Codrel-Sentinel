set shell := ["bash", "-cu"]

set dotenv-load := true

infra-up:
	cd infra && docker compose up -d

infra-down:
	cd infra && docker compose down

infra-logs:
	cd infra && docker compose logs -f


backend:
	cd backend && pnpm dev

worker-elevenlab:
	cd workers/elevenlab && go run .

worker-ingest:
	cd workers/ingest && go run .

worker-events:
	cd workers/events && go run .

workers:
	cd workers/elevenlab && go run . & \
	cd workers/ingest && go run . & \
	cd workers/events && go run . & \
	wait

dev:
	cd infra && docker compose up -d
	cd backend && pnpm dev & \
	cd workers/elevenlab && go run . & \
	cd workers/ingest && go run . & \
	cd workers/events && go run . & \
	wait

clean:
	cd infra && docker compose down