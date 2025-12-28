import { eq } from "drizzle-orm";
import db from "../../../lib/db/db";
import { IngestContext } from "./orchestrator";
import { projectsTable } from "../../../lib/db/schema";

export async function sqlCleanup(ctx: IngestContext) {
  if (!ctx.projectId) return;

  try {
    await db.delete(projectsTable).where(eq(projectsTable.id, ctx.projectId!));
  } catch { return null }
}
