import { NextResponse } from "next/server";
import { AppError } from "../ingest/AppError";
import { getRagContext } from "../../../lib/langchain/service";
import { stepAuth } from "../ingest/step.auth";
import { ApiError } from "next/dist/server/api-utils";
import { logEvent } from "../../../lib/analytics/logs";
import { db } from "../../../lib/db/db";
export interface Askcontext {
  userEmail: string | null;
  projectId: string | null;
  userId?: string | null;
  client?: "agent" | "web" | "cli";
  cloud?: boolean;
}

export async function POST(req: Request) {
  const ctx: Askcontext = {
    userEmail: null,
    projectId: null,
    client: "agent",
    cloud: true,
  };

  const start = performance.now();

  try {
    const { query, k = 15, filter, projectId, cloud } = await req.json();
    ctx.projectId = projectId;
    ctx.cloud = cloud;

    if (k <= 5 || k > 100)
      throw new ApiError(400, "k must be between 5 and 100");
    if (!ctx.projectId) throw new ApiError(400, "Missing projectId");
    if (!query) throw new AppError("Missing query", 400);

    await stepAuth(req, ctx);

    const project = await db.query.projectsTable.findFirst({
      where: (p, { eq }) => eq(p.id, ctx.projectId!),
    });

    if (!project)
      throw new AppError(`Project '${ctx.projectId}' not found`, 404);

    if (!ctx.cloud)
      if (project.email !== ctx.userEmail)
        throw new AppError(
          "Forbidden: this local project belongs to another user",
          403
        );

    const raw = await getRagContext(query, ctx, { topk: k, filter });
    const latency = Math.round(performance.now() - start);

    const scores = raw.map(([, score]) => score);
    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
    const min = scores.length ? Math.min(...scores) : null;
    const max = scores.length ? Math.max(...scores) : null;

    void logEvent({
      event: "ask",
      userEmail: ctx.userEmail!,
      projectId: ctx.projectId!,
      success: true,
      metadata: {
        latency_ms: latency,
        query_length: query.length,
        k,
        retrievals: raw.length,
        filter_used: !!filter,
        vector_avg_score: avg,
        vector_min_score: min,
        vector_max_score: max,
        client: ctx.client,
        owner: project.email,
        type: project.type,
        user: ctx.userEmail,
      },
    });
    return NextResponse.json({
      success: true,
      retrievals: raw.length,
      results: raw.map(([doc, score]) => {
        const dist = Number(score);
        const sim = 1 - Math.min(dist, 2) / 2;
        return {
          vectorScore: sim,
          id: doc.id,
          metadata: doc.metadata,
          pageContent: doc.pageContent,
        };
      }),
    });
  } catch (err) {
    const latency = Math.round(performance.now() - start);

    void logEvent({
      event: "ask",
      userEmail: ctx.userEmail ?? "unknown",
      projectId: ctx.projectId,
      success: false,
      error: (err as Error).message,
      metadata: {
        latency_ms: latency,
        client: ctx.client,
        user: ctx.userEmail,
      },
    });

    const status = err instanceof AppError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
