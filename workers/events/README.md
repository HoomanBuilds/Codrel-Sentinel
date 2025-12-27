# Events Worker

Consumes risk events and emits Datadog telemetry.

## Responsibility

- Listen to `codrel.risk.events` topic
- Forward metrics to Datadog
- Alert on blocked changes

## Run

```bash
go run main.go
```

## Kafka Topics

Input: `codrel.risk.events`

```json
{
  "eventId": "evt-123",
  "repoId": "repo-1",
  "assessment": {
    "riskScore": 0.75,
    "decision": "block",
    "reasons": ["Critical path: auth/"]
  },
  "timestamp": 1703654321
}
```

## Datadog Metrics Emitted

- `sentinel.risk_score` - Risk score with repo_id tag
- `sentinel.blocked_changes` - Counter for blocked changes
- `sentinel.decision` - Decision distribution
