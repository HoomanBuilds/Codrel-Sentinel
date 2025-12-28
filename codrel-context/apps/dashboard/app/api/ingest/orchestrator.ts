import { stepAuth, stepIngestQuota } from "./step.auth";
import { stepParse } from "./step.parse";
import { stepSQL } from "./step.sql";
import { stepVector } from "./step.vector";
import { sqlCleanup } from "./compensate.sql";
import { logEvent } from "../../../lib/analytics/logs";

export interface CodrelChunk {
  id?: string;
  chunkIdx?: number;
  filePath?: string;
  relativePath?: string;
  extension?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  treePath?: string[];
  text: string;
  tokenLength?: number;
  source?: string;
  sourceType?: string;
}

export interface IngestContext {
  projectId: string | null;
  userEmail: string | null;
  chunks: CodrelChunk[];
  client: "cli" | "web";
  totalTokens: number;
  newChunkCount: number;
  sources?: string[];
  isNewProject: boolean;
  name?: string;
  cloud?: boolean;
}

export async function ingest(req: Request) {
  const start = performance.now();

  const ctx: IngestContext = {
    projectId: null,
    userEmail: null,
    chunks: [],
    client: "cli",
    totalTokens: 0,
    newChunkCount: 0,
    sources: [],
    isNewProject: false,
    name: "Untitled Project",
    cloud: true,
  };

  try {
    await stepAuth(req, ctx);

    const parseStart = performance.now();
    await stepParse(req, ctx);
    const parseLatency = Math.round(performance.now() - parseStart);

    const sqlStart = performance.now();
    await stepSQL(ctx);
    const sqlLatency = Math.round(performance.now() - sqlStart);

    const quotaStart = performance.now();
    await stepIngestQuota(ctx);
    const quotaLatency = Math.round(performance.now() - quotaStart);

    const usageStart = performance.now();
    const usageLatency = Math.round(performance.now() - usageStart);

    const vectorStart = performance.now();
    await stepVector(ctx);
    const vectorLatency = Math.round(performance.now() - vectorStart);

    const totalLatency = Math.round(performance.now() - start);

    void logEvent({
      event: "ingest",
      userEmail: String(ctx.userEmail),
      projectId: ctx.projectId,
      success: true,
      metadata: {
        latency_ms: totalLatency,
        parse_latency_ms: parseLatency,
        quota_latency_ms: quotaLatency,
        usage_latency_ms: usageLatency,
        sql_latency_ms: sqlLatency,
        vector_latency_ms: vectorLatency,
        client: ctx.client,
        newChunkCount: ctx.newChunkCount,
        totalTokens: ctx.totalTokens,
        sourceCount: ctx.sources?.length ?? 0,
        fileExtensions: [...new Set(ctx.chunks.map((c) => c.extension))],
        isNewProject: ctx.isNewProject,
      },
    });

    return { ok: true, id: ctx.projectId, stored: ctx.chunks.length };
  } catch (err) {
    const totalLatency = Math.round(performance.now() - start);

    await sqlCleanup(ctx);

    void logEvent({
      event: "ingest",
      userEmail: String(ctx.userEmail ?? "unknown"),
      projectId: ctx.projectId,
      success: false,
      error: (err as Error).message,
      metadata: {
        total_latency_ms: totalLatency,
        client: ctx.client,
        newChunkCount: ctx.newChunkCount,
        totalTokens: ctx.totalTokens,
      },
    });

    throw err;
  }
}
