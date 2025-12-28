import db from "../../../lib/db/db";
import { Askcontext } from "../ask/route";
import { AppError } from "./AppError";
import type { IngestContext } from "./orchestrator";

export async function stepAuth<T extends IngestContext | Askcontext>(
  req: Request,
  ctx: T
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new AppError("Unauthorized", 401);

  const raw = await db.query.tokensTable.findFirst({
    where: (tokensTable, { eq }) => eq(tokensTable.token, token),
  });

  if (!raw || !raw.email) {
    throw new AppError("Invalid token", 401);
  }

  ctx.userEmail = raw.email as string;

  const c = req.headers.get("codrelai_client");
  ctx.client = c as T["client"];

  return ctx;
}

export async function stepIngestQuota(ctx: IngestContext) {
  const user = await db.query.usersTable.findFirst({
    where: (u, { eq }) => eq(u.email, String(ctx.userEmail)),
  });

  if (!user) throw new AppError("no user associated with token", 404);

  const MAX_PROJECT_LIMIT = 5
  if (user.totalProjects >= MAX_PROJECT_LIMIT)
    throw new AppError(`Project limit reached for Account (${MAX_PROJECT_LIMIT})`, 403);
  
  const MAX_CHUNK_LIMIT = 2000
  if (user.totalChunks + ctx.newChunkCount >= MAX_CHUNK_LIMIT)
    throw new AppError(`Chunk limit reached for Account (${MAX_CHUNK_LIMIT})`, 403);

  return ctx;
}
