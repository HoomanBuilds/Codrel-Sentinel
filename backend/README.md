# Sentinel Backend

Node.js + Express backend for AI code governance.

## Setup

```bash
npm install
cp ../.env.example .env
npm run dev
```

## MCP Tools (15 Endpoints)

### Risk Assessment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mcp/assessFileRisk` | Assess risk for changed files |
| POST | `/mcp/analyzeFile` | Analyze single file with RAG context |

### Repository Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mcp/connectRepo` | Onboard new repository |
| POST | `/mcp/disconnectRepo` | Remove repository |
| POST | `/mcp/triggerIndex` | Trigger repo indexing |
| GET | `/mcp/indexStatus/:jobId` | Check indexing job status |
| GET | `/mcp/repoStatus/:repoId` | Get repo health & stats |
| POST | `/mcp/ingestSignal` | Ingest CI/CD signals |
| GET | `/mcp/fileHistory/:repo/:path` | Get file's risk history |

### Agent Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mcp/agentStats/:agent` | Get agent behavior stats |
| GET | `/mcp/agentList` | List all known agents |
| POST | `/mcp/reportAgentBehavior` | Report suspicious agent |
| POST | `/mcp/blockAgent` | Block an agent |

### Voice (ElevenLabs)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mcp/triggerVoice` | Trigger voice explanation |
| POST | `/mcp/explainDecision` | Generate decision explanation |
| GET | `/mcp/voiceStatus/:eventId` | Check voice generation status |

## Webhooks (External Events)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/github` | GitHub push, PR, check events |
| POST | `/webhooks/datadog` | Datadog alert callbacks |
| POST | `/webhooks/ci` | Generic CI/CD (Jenkins, CircleCI, etc) |

## Example Flows

### 1. Connect Repository & Start Indexing
```bash
curl -X POST http://localhost:3000/mcp/connectRepo \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/acme/app",
    "owner": "acme",
    "name": "app"
  }'
# Returns: { repoId, webhookSecret, indexJobId }
```

### 2. Assess Risk (AI Agent Call)
```bash
curl -X POST http://localhost:3000/mcp/assessFileRisk \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "acme/app",
    "agent": "cursor",
    "changedFiles": ["src/auth/login.ts"]
  }'
# Returns: { riskScore: 0.65, decision: "warn", reasons: [...] }
```

### 3. Ingest CI Failure Signal
```bash
curl -X POST http://localhost:3000/mcp/ingestSignal \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "acme/app",
    "signalType": "ci_failure",
    "filePaths": ["src/auth/login.ts", "src/auth/oauth.ts"]
  }'
```

### 4. Block Rogue Agent
```bash
curl -X POST http://localhost:3000/mcp/blockAgent \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "rogue-bot",
    "reason": "Repeated security violations",
    "duration": "24h"
  }'
```

## Architecture

```
routes/
├─ mcp.ts        # Core risk assessment
├─ repo.ts       # Repository management
├─ agent.ts      # Agent tracking
├─ voice.ts      # ElevenLabs integration
├─ webhooks.ts   # External event handlers
└─ health.ts     # Health checks

services/
├─ riskEngine.ts    # Rule-based risk scoring
├─ db.ts            # Data persistence
├─ kafkaProducer.ts # Event publishing
└─ datadog.ts       # Telemetry

models/
├─ repo.ts        # Repo, IndexJob, AgentActivity
├─ fileMeta.ts    # File signals
└─ riskEvent.ts   # Risk decisions
```

## Kafka Topics

| Topic | Producer | Consumer |
|-------|----------|----------|
| `codrel.risk.events` | Backend | Events Worker |
| `codrel.file.signals` | Backend/Webhooks | Ingest Worker |
| `codrel.index.jobs` | Backend | Ingest Worker |
| `codrel.elevenlab.calls` | Backend | ElevenLabs Worker |
| `codrel.repo.events` | Backend | - |
