import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOption";
import { logEvent } from "../../../../lib/analytics/logs";
import db from "../../../../lib/db/db";
import { projectsTable } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { createEmbeddings } from "../../../../lib/langchain/service";
import { createVectorStore } from "../../../../lib/db/vectorDB";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const projectId = id;  
  const start = performance.now();

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    await logEvent({
      event: "project_delete",
      userEmail: "unknown",
      success: false,
      error: "unauthorized",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;

  const existing = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));

  deleteChromaForProject(projectId).catch(async (err) => {
    await logEvent({
      event: "project_vector_cleanup",
      userEmail: email,
      projectId,
      success: false,
      error: String(err),
    });
  });

  await logEvent({
    event: "project_delete",
    userEmail: email,
    projectId,
    success: true,
    metadata: { latency_ms: Math.round(performance.now() - start) }
  });

  return NextResponse.json({ ok: true, projectId });
}

async function deleteChromaForProject(projectId: string) {
  const embeddings = createEmbeddings();
  const store = createVectorStore({ projectId }, embeddings);

  try {
    await store.ensureCollection();  
    await store.index?.deleteCollection({ name : store.collectionName});
  } catch (err) {
    if ((err as Error).message?.includes("not found") || (err as Error).message?.includes("does not exist")) {
      return;
    }
    throw err;
  }
}
