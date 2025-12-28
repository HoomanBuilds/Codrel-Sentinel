import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOption";
import { logEvent } from "../../../lib/analytics/logs";
import db from "../../../lib/db/db";
import { projectsTable } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const start = performance.now();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    void logEvent({
      event: "projects_list",
      userEmail: "unknown",
      success: false,
      error: "unauthorized",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.email, email));

  void logEvent({
    event: "projects_list",
    userEmail: email,
    success: true,
    metadata: {
      count: rows.length,
      latency_ms: Math.round(performance.now() - start)
    }
  });

  return NextResponse.json({ projects: rows });
}
