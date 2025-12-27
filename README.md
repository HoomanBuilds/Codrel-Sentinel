# Codrel Sentinel

Governance and risk-assessment layer for AI/agent code changes.

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Workers (each in separate terminal)
cd workers/ingest && go run main.go
cd workers/events && go run main.go
cd workers/elevenlab && go run main.go
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  IDE Agent  │────▶│   Backend    │────▶│    Kafka    │
│  (Cursor)   │     │  (Express)   │     │  (Topics)   │
└─────────────┘     └──────┬───────┘     └──────┬──────┘
                          │                     │
                          ▼                     ▼
                   ┌──────────────┐     ┌─────────────┐
                   │   Postgres   │     │   Workers   │
                   │    (Neon)    │     │    (Go)     │
                   └──────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Datadog   │
                                        │ (Telemetry) │
                                        └─────────────┘
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /mcp/assessFileRisk | Assess risk for changed files |
| POST | /mcp/analyzeFile | Analyze single file with RAG context |
| GET | /health | Health check |

## Risk Decisions

- **allow** (0.0-0.3): Safe to proceed
- **warn** (0.3-0.7): Proceed with caution
- **block** (0.7-1.0): Requires human review
