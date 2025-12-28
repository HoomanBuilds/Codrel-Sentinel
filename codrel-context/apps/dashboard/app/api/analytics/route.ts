import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOption";
import db from "../../../lib/db/db";
import { analyticsTable, projectsTable } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;
  const rawEvents = await db
    .select()
    .from(analyticsTable)
    .where(eq(analyticsTable.userEmail, email))
    .orderBy(desc(analyticsTable.ts))
    .limit(500);

  const events = rawEvents.filter((e) =>
    [
      "ask",
      "ingest",
      "project_create",
      "project_delete",
      "token_create",
      "token_delete",
    ].includes(e.event)
  );

  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.email, email));

  const stats = {
    totalEvents: events.length,
    askCount: events.filter((e) => e.event === "ask").length,
    ingestCount: events.filter((e) => e.event === "ingest").length,
    projectCreated: events.filter((e) => e.event === "project_create").length,
    tokenCreated: events.filter((e) => e.event === "token_create").length,
    tokenDeleted: events.filter((e) => e.event === "token_delete").length,
    lastEventAt: events[0]?.ts ?? null,
    totalProjects: projects.length,
    totalVectorsEverCreated: events
      .filter((e) => e.event === "ingest" && e.success)
      .reduce((acc, ev) => {
        const meta = ev.metadata as { newChunkCount?: number };
        return acc + (meta.newChunkCount ?? 0);
      }, 0),
    totalVectors: projects.reduce(
      (acc, project) => acc + (project.totalChunks || 0),
      0
    ),
  };

  const grouped = events.reduce(
    (acc, ev) => {
      if (!acc[ev.event]) acc[ev.event] = [];
      (acc[ev.event] as unknown[]).push({
        ts: ev.ts,
        projectId: ev.projectId,
        success: ev.success,
        error: ev.error,
        metadata: ev.metadata,
      });
      return acc;
    },
    {} as Record<string, unknown[]>
  );

  return NextResponse.json({
    ok: true,
    stats,
    grouped,
    events,
    allProjects: projects,
  });
}
