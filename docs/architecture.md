# Codrel Sentinel Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              CODREL SENTINEL ARCHITECTURE                                 │
│                        Governance & Risk-Assessment for AI Agents                        │
└──────────────────────────────────────────────────────────────────────────────────────────┘

                                    USER SIDE (External)
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐                     │
│  │   GitHub Repo   │    │   CI/CD Pipeline │    │  AI Agent (IDE) │                     │
│  │                 │    │  (Jenkins, etc)  │    │  (Cursor, etc)  │                     │
│  └────────┬────────┘    └────────┬─────────┘    └────────┬────────┘                     │
│           │                      │                       │                               │
│           │ Webhook              │ Webhook               │ MCP Tool Call                │
│           │ (push, PR,           │ (build failure,       │ (assessFileRisk,             │
│           │  check_run)          │  success)             │  fileHistory)                │
│           │                      │                       │                               │
└───────────┼──────────────────────┼───────────────────────┼──────────────────────────────┘
            │                      │                       │
            ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               CODREL SENTINEL BACKEND                                     │
│                                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           Express Server (Node.js + TypeScript)                     │ │
│  │                                                                                     │ │
│  │  ┌──────────────────┐   ┌───────────────────┐   ┌───────────────────┐             │ │
│  │  │  /webhooks/github │   │   /webhooks/ci    │   │    /mcp/*         │             │ │
│  │  │                   │   │                   │   │                   │             │ │
│  │  │  • Handle PR      │   │  • Handle build   │   │  • assessFileRisk │             │ │
│  │  │  • Handle push    │   │    failures       │   │  • fileHistory    │             │ │
│  │  │  • Handle checks  │   │  • Handle deploy  │   │  • analyzeFile    │             │ │
│  │  └────────┬──────────┘   └─────────┬─────────┘   └─────────┬─────────┘             │ │
│  │           │                        │                       │                        │ │
│  │           └────────────────────────┼───────────────────────┘                        │ │
│  │                                    │                                                │ │
│  │                                    ▼                                                │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │                         EVERY REQUEST LOGS TO DATADOG                        │   │ │
│  │  │                                                                              │   │ │
│  │  │  logRequest()          → HTTP request/response metrics                       │   │ │
│  │  │  logCIFailure()        → CI failures by file (builds history)               │   │ │
│  │  │  logFileSignal()       → File risk signals (reverts, hotfixes)              │   │ │
│  │  │  logRiskAssessment()   → AI agent decisions & scores                        │   │ │
│  │  │  logWebhookEvent()     → All incoming webhook events                        │   │ │
│  │  │  logInternalError()    → Codrel's own errors (for internal ops)             │   │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                Supporting Services                                    ││
│  │                                                                                       ││
│  │  ┌────────────────┐   ┌────────────────┐   ┌───────────────────┐                    ││
│  │  │   Risk Engine  │   │    Database    │   │   Kafka Producer  │                    ││
│  │  │                │   │   (Postgres)   │   │                   │                    ││
│  │  │  • Score files │   │                │   │  • risk.events    │                    ││
│  │  │  • Check rules │   │  • repos       │   │  • file.signals   │                    ││
│  │  │  • Decisions   │   │  • file_meta   │   │  • elevenlab.calls│                    ││
│  │  └────────────────┘   │  • risk_events │   └───────────────────┘                    ││
│  │                       └────────────────┘                                             ││
│  └──────────────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────────────┘
            │                                                              │
            │  Logs via API                                                │ Kafka Messages
            ▼                                                              ▼
┌───────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│              DATADOG                       │    │            GO WORKERS                   │
│                                            │    │                                         │
│  ┌────────────────────────────────────┐   │    │  ┌───────────────┐  ┌───────────────┐  │
│  │            Logs                     │   │    │  │ Ingest Worker │  │ Events Worker │  │
│  │                                     │   │    │  └───────────────┘  └───────────────┘  │
│  │  • Every HTTP request              │   │    │                                         │
│  │  • CI failures by file             │   │    │  ┌────────────────────────────────────┐│
│  │  • Webhook events                  │   │    │  │       ElevenLabs Worker            ││
│  │  • Risk assessments                │   │    │  │                                    ││
│  │  • File signals                    │   │    │  │  Consumes: elevenlab.calls         ││
│  │                                     │   │    │  │  Calls: ElevenLabs API             ││
│  └────────────────────────────────────┘   │    │  │  Alerts: CODREL TEAM ONLY          ││
│                                            │    │  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐   │    └─────────────────────────────────────────┘
│  │          Monitors                   │   │
│  │                                     │   │                   │
│  │  • High Risk Changes               │   │                   │
│  │  • Token Exhausted                 │   │                   │
│  │  • Rate Limit Hit                  │   │                   │
│  │  • Agent Abuse Detected            │   │                   │
│  │  • CI Failure Spike                │   │                   │
│  └─────────────┬──────────────────────┘   │                   │
│                │                          │                   │
│                │ Webhook when alert fires │                   │
│                ▼                          │                   │
│  ┌────────────────────────────────────┐   │                   │
│  │      DD Webhook → Codrel           │   │                   │
│  │                                     │   │                   │
│  │  POST /webhooks/datadog            │   │                   │
│  │  → Triggers ElevenLabs call        │───┼───────────────────┘
│  │     to CODREL TEAM for             │   │
│  │     internal operations            │   │
│  └────────────────────────────────────┘   │
└────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           KEY FLOW: AI AGENT GETS CONTEXT                                │
│                                                                                          │
│   1. CI Fails → Webhook hits /webhooks/ci → logCIFailure() → DD stores "file X failed"  │
│                                                                                          │
│   2. AI Agent calls /mcp/fileHistory → Codrel queries DD logs + local DB                │
│                                                                                          │
│   3. Response includes promptContext: "⚠️ HIGH RISK: This file failed CI 3 times"       │
│                                                                                          │
│   4. AI Agent enriches its own prompt with this context before making changes           │
│                                                                                          │
│   5. If agent proceeds and causes another failure → signal recorded → risk score ↑      │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           KEY FLOW: INTERNAL ALERTS (ELEVENLABS)                         │
│                                                                                          │
│   1. Codrel backend logs error → DD receives log with level=error                        │
│                                                                                          │
│   2. DD Monitor "Token Exhausted" fires → DD sends webhook to /webhooks/datadog         │
│                                                                                          │
│   3. Codrel backend publishes to Kafka topic: elevenlab.calls                           │
│                                                                                          │
│   4. ElevenLabs Worker calls ElevenLabs API → CODREL TEAM gets voice alert              │
│                                                                                          │
│   NOTE: ElevenLabs is for CODREL INTERNAL OPS, NOT for end users!                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Summary

| Component | Purpose | Users |
|-----------|---------|-------|
| **Webhooks** | Receive events from GitHub/CI | External (users) |
| **MCP Tools** | AI agent queries for context | External (IDE agents) |
| **Datadog Logs** | Store ALL request/event history | Internal (Codrel ops) |
| **Datadog Monitors** | Alert on anomalies | Internal (Codrel ops) |
| **ElevenLabs** | Voice alerts for Codrel team | Internal (Codrel ops ONLY) |

## Environment Variables

```bash
# Datadog
DD_API_KEY=your_api_key
DD_SITE=datadoghq.com
DD_SERVICE=codrel-sentinel
DD_ENV=production

# ElevenLabs (Internal Ops)
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=your_voice_id

# Kafka
KAFKA_BROKERS=localhost:9092

# Database
DATABASE_URL=postgres://...
```
