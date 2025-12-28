import { AppError } from "./AppError";
import { CodrelChunk, IngestContext } from "./orchestrator";

const MAX_TOTAL_CHARS = 450_000;

export async function stepParse(req: Request, ctx: IngestContext) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", 400);
  }

  const clientHeader = req.headers.get("codrelai_client") as IngestContext["client"];
  const client = clientHeader === "cli" || clientHeader === "web" ? clientHeader : null;
  if (!client) throw new AppError("Invalid client", 400);
  ctx.client = client;

  ctx.projectId = body.metadata?.projectId ?? null;
  ctx.name = body.metadata?.projectName ?? "Untitled";
  ctx.cloud = body.metadata?.cloud;
  ctx.totalTokens = body.metadata?.totalTokens ?? 0;
  ctx.sources = body.metadata?.sources ?? [];

  ctx.chunks = stepValidate(body);
  ctx.newChunkCount = ctx.chunks.length;
}

export function stepValidate(body: { chunks: CodrelChunk[] }): CodrelChunk[] {
  if (!body || typeof body !== "object")
    throw new AppError("Invalid request body", 400);

  if (!Array.isArray(body.chunks))
    throw new AppError("Invalid content format", 400);

  const totalChars = body.chunks.reduce((n, c) => n + (c.text?.length ?? 0), 0);

  if (totalChars > MAX_TOTAL_CHARS)
    throw new AppError("Content too large to process", 400);

  return body.chunks;
}
