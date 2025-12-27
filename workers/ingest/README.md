# Ingest Worker

Consumes file signals from Kafka and updates metadata store.

## Responsibility

- Listen to `codrel.file.signals` topic
- Update file metadata (CI failures, reverted PRs, change frequency)
- Maintain in-memory store (mock DB)

## Run

```bash
go run main.go
```

## Kafka Topic

Input: `codrel.file.signals`

```json
{
  "repoId": "repo-1",
  "filePath": "src/auth/login.ts",
  "signal": { "type": "ci_failure" },
  "timestamp": 1703654321
}
```

## Signal Types

- `ci_failure` - CI build failed for this file
- `pr_reverted` - PR containing this file was reverted
- `hotfix` - Emergency fix applied
- `security_patch` - Security update
