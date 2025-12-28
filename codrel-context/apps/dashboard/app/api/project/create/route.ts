import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { logEvent } from "../../../../lib/analytics/logs";
import db from "../../../../lib/db/db";
import { projectsTable } from "../../../../lib/db/schema";
import { authOptions } from "../../../../lib/authOption";

export async function POST(req: Request) {
  const start = performance.now();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    void logEvent({
      event: "project_create",
      userEmail: "unknown",
      success: false,
      error: "unauthorized",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;
  const body = await req.json();

  const name: string = body.name?.trim() || "Untitled Project";
  const description: string = body.description?.trim() || "";

  const projectId = `codrel-${crypto.randomUUID()}`;

  await db.insert(projectsTable).values({
    id: projectId,
    email,
    name,
    description,
    client: "web",
    totalChunks: 0,
    totalTokens: 0,
    type: "web",
  });

  void logEvent({
    event: "project_create",
    userEmail: email,
    projectId,
    success: true,
    metadata: {
      name,
      description,
      latency_ms: Math.round(performance.now() - start)
    }
  });

  return NextResponse.json({
    ok: true,
    projectId,
    name,
    description,
  });
}
