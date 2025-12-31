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
	cd workers/ingestion && go run .

worker-analyzer:
	cd workers/analyzer && npm run dev

worker-events:
	cd workers/events && go run .

worker-sentinelBot:
	cd workers/sentinelBot && go run .

workers:
	cd workers/elevenlab && go run . & \
	cd workers/ingestion && go run . & \
	cd workers/sentinelBot && go run . & \
	cd workers/analyzer && npm run dev & \
	cd workers/events && go run . & \
	wait

tunnel:
	cloudflared tunnel --config ~/.cloudflared/sentinel.yml run codrel-sentinel


dev:
	cd infra && docker compose up -d
	cd backend && pnpm dev & \
	cd workers/elevenlab && go run . & \
	cd workers/ingest && go run . & \
	cd workers/events && go run . & \
	wait

clean:
	cd infra && docker compose down

dashboard-dev:
	cd dashboard && pnpm run dev

dashboard:
	cd dashboard && pnpm run start

p1:
	cd dashboard && pnpm run start & \
	cd workers/ingestion && go run . & \
	cd workers/analyzer && pnpm run dev & \
	cd workers/sentinelBot && go run . & \
	cloudflared tunnel --config ~/.cloudflared/sentinel.yml run codrel-sentinel & \
	wait

