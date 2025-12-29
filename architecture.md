# Codrel Sentinel Architecture

Codrel Sentinel is a **repository context and safety engine** that continuously analyzes repository history and exposes that context to AI agents and PR bots.

It is built around **async processing**, **historical analysis**, and **context reuse**.

---

## High-Level Architecture

```
┌───────────────┐
│ Git Providers │  (GitHub, GitLab)
└───────┬───────┘
        │ Webhooks (PRs, issues, CI, workflows)
        ▼
┌──────────────────────────┐
│ Codrel Sentinel Backend  │
│ (Node.js + TypeScript)   │
├──────────────────────────┤
│ • Repo connection        │
│ • Webhook ingestion      │
│ • MCP endpoints          │
│ • Context serving        │
│ • Event publishing       │
└───────┬──────────────────┘
        │ Kafka events
        ▼
┌──────────────────────────┐
│ Confluent Kafka          │
│ (Async backbone)         │
└───────┬──────────────────┘
        │
        ▼
┌──────────────────────────┐
│ Workers (Go)             │
├──────────────────────────┤
│ • Ingestion              │
│ • AI analyzer + preserve │
│   (Google Gemini)        │
│ • call alert (elevenLab) │
│ • sentinelBot            │
│ • Continuous sync        │
│ • events and logging     |
|   (datadog)              |
└───────┬──────────────────┘
        │
        ▼
┌──────────────────────────┐
│ Storage                  │
│ (Postgres + vector)      │
├──────────────────────────┤
│ • Repo metadata          │
│ • File risk signals      │
│ • Vector store           │
│ • Historical summaries   │
└──────────────────────────┘
```

---

![Codrel Sentinel Architecture](./assets/arch.png)

---

## Repository Processing Flow

### 1. Repository Connection

* User installs the app and connects a repository
* Sentinel registers the repo
* An indexing job is published to Kafka

### 2. Historical Analysis (Async)

Workers analyze:

* pull request history
* reverted and failed changes
* workflow and CI crashes
* issues linked to files
* sensitive paths (security, auth, infra)

Gemini is used **only here** to:

* analyze failure patterns
* associate failures with files
* generate compact, reusable context summaries

### 3. Context Storage

Results are stored as:

* structured file-level signals (counts, flags)
* compressed historical explanations

This context becomes the **long-term memory** of the repository.

---

## Continuous Sync

Sentinel keeps context fresh.

Events such as:

* PR merges or reverts
* issue closures
* workflow failures

are:

1. ingested via webhooks
2. published to Kafka
3. processed by workers
4. merged into existing repo context

No reprocessing from scratch.

---

## IDE Agent Flow (MCP)

When an IDE AI agent edits code:

1. Agent reports changed file(s)
2. Agent calls Sentinel MCP tools (e.g. file safety check)
3. Sentinel returns **precomputed context**:

   * past failures
   * historical risk
   * why the file is sensitive

No runtime AI analysis is required on Sentinel’s side.
The agent reasons using the provided context.

---

## PR Bot Flow (SentinelBot)

When a pull request is opened or updated:

1. SentinelBot receives the PR diff and file list
2. Workers fetch existing context for those files
3. Gemini analyzes the PR **in light of historical context**
4. SentinelBot posts a PR comment explaining:

   * which files are risky
   * what broke before
   * what to watch out for

This is context-aware review, not generic code review.

---

## Operational Observability & Alerts

Sentinel emits internal telemetry from:

* API endpoints
* webhook ingestion
* workers
* Kafka consumers
* AI usage and failures

This telemetry is used to:

* monitor system health
* detect anomalies
* trigger alerts

For critical operational incidents:

1. An alert fires
2. A Kafka job is published
3. A worker generates a short spoken explanation
4. A voice alert is triggered via ElevenLabs

This is used only for **internal operations**.

---

## Key Design Principles

* async by default
* no AI in the hot path
* context is built once, reused everywhere
* agents reason, Sentinel remembers
* history > heuristics