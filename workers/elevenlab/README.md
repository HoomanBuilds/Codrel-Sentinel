# ElevenLabs Worker

Generates voice explanations for critical incidents.

## Responsibility

- Listen to `codrel.elevenlab.calls` topic
- Generate spoken explanations for blocked changes
- Mock API calls (no real voice generation)

## Run

```bash
go run main.go
```

## Kafka Topic

Input: `codrel.elevenlab.calls`

```json
{
  "eventId": "evt-123",
  "message": "Blocked change in repo-1: Critical auth path modified",
  "priority": "high"
}
```

## Priority Levels

- `low` - Informational, queued
- `medium` - Generated within 1 minute
- `high` - Immediate generation

## Environment Variables

```bash
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=voice_id
```
