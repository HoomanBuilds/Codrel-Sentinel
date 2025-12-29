# Codrel Sentinel

**Context & Safety Engine for AI Coding Agents**

Codrel Sentinel is a **repository-aware context engine** that helps AI agents and PR bots understand **what parts of a codebase are dangerous to change and why**.

It builds **deep historical context** from a repository (PRs, CI failures, reverts, issues, workflow crashes), keeps that context **continuously up to date**, and exposes it to:

* IDE AI agents (via MCP tools)
* Pull request bots (SentinelBot)

Sentinel does **not replace agents**.
It **feeds them the right context** so they don’t repeat past mistakes.

---

## Core Idea

> AI agents fail because they don’t remember what broke before.

Codrel Sentinel fixes this by:

1. **Analyzing repo history once**
2. **Keeping it synced in real time**
3. **Serving that context back to agents and bots**

No guessing. No re-learning. No blind refactors.

---

## High-Level Flow

```
User connects repository
        ↓
Historical repo analysis (async workers)
        ↓
File-level risk & context is built
        ↓
Context is stored and kept in sync
        ↓
IDE agents & PR bots query Sentinel
        ↓
Agents act with full historical awareness
```

---

## What Happens When a Repo Is Connected

### 1. Initial Repository Processing (Async)

When a user connects a repository (GitHub today, GitLab later):

Sentinel analyzes **all critical historical signals**:

* pull requests
* reverted / rolled-back changes
* workflow & CI crashes
* issues linked to files
* sensitive paths (security, auth, infra, payments)

This processing is done by **workers**, not the API.

### 2. Gemini-Powered Historical Analysis

For each important file/module, workers use **Gemini** to:

* analyze *why* failures happened
* identify patterns (fragile files, risky changes)
* associate failures with specific files

This produces **compressed, durable context**, such as:

* “Changes to `security.js` repeatedly caused auth regressions”
* “This module has a history of CI failures after refactors”

This context is stored once and reused everywhere.

---

## Continuous Sync (Not One-Time)

Sentinel stays up to date.

Whenever these events happen:

* new PR merged / reverted
* issue opened or closed
* workflow fails
* CI crashes

They are:

1. ingested via webhooks
2. published to Confluent Kafka
3. processed asynchronously by workers
4. merged into existing repo context

The repository’s “memory” keeps evolving.

---

## How IDE Agents Use Sentinel (MCP)

When an IDE AI agent edits code:

Example:

> Agent modifies `security.js`

The agent calls an MCP tool like:

```
check_file_safety
```

Sentinel responds with **context**, not opinions:

* this file’s historical failures
* why it’s considered risky
* what kind of changes broke it before

No extra AI analysis is needed on Sentinel’s side.
The agent already has everything it needs to reason correctly.

---

## How PR Bot (SentinelBot) Works

When a pull request is opened or updated:

1. SentinelBot sends:

   * diff
   * changed file list
   * PR metadata
2. Workers fetch **pre-built context** for those files
3. Gemini is used (here) to:

   * analyze the PR *in light of past failures*
4. SentinelBot posts a PR comment:

   * explaining risk
   * highlighting fragile files
   * warning about past breakages

This is **context-aware review**, not generic AI code review.

---

## Event & Worker Pipeline (Confluent)

Confluent Kafka is used as the backbone for all async work:

* repo indexing jobs
* history sync jobs
* PR analysis jobs
* voice alert jobs

This allows:

* non-blocking APIs
* scalable processing
* replayable analysis

---

## Observability & Alerts (Datadog)

Sentinel emits **high-signal telemetry** from its internal services and pipelines, including:

* API request rates, latency, and error patterns
* webhook ingestion reliability
* worker execution status and retries
* Kafka consumer lag and queue backlogs
* AI request latency, failures, and quota-related errors

Datadog is used to:

* monitor the health of Codrel Context and Codrel Sentinel services
* surface anomalies across async pipelines and background workers
* trigger alerts via webhooks when operational thresholds are breached
This ensures the system remains reliable as repository analysis, agent interactions, and background processing scale.

---

## Voice Alerts (ElevenLabs)

For **critical risk events** only:

1. Datadog triggers a webhook
2. Sentinel publishes a Kafka job
3. A worker:

   * uses Gemini to generate a short explanation
   * uses ElevenLabs to synthesize voice
4. A voice call / alert is triggered

Voice is used for **incident-level signals**, not daily noise.

---

## What Codrel Sentinel Is (and Is Not)

### Sentinel **is**

* a repository context engine
* a memory system for AI agents
* a safety layer for AI-driven changes
* a bridge between repo history and agents

### Sentinel is **not**

* a linter
* a CI runner
* a code generator
* a generic chatbot
* a replacement for human review

---

## Why This Matters

Without Sentinel:

* every agent relearns the same mistakes
* risky files get refactored again and again
* context is lost between PRs

With Sentinel:

* agents know what broke before
* PR reviews are grounded in history
* teams build institutional memory for AI

---

## One-Line Summary

> **Codrel Sentinel gives AI agents and PR bots a living memory of a repository — so they know which files are safe, which are fragile, and why.**