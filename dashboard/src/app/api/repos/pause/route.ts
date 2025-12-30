import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repositories } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userIdentifier = session?.user?.email || (session?.user as any)?.login;

  if (!userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: repositories.id,
      status: repositories.status,
      error: repositories.error,
    })
    .from(repositories)
    .where(eq(repositories.connectedBy, userIdentifier));

  return NextResponse.json({ repos: rows });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const userIdentifier = session?.user?.email || (session?.user as any)?.login;

  if (!userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Repository ID is required" }, { status: 400 });
    }

    const result = await db
      .update(repositories)
      .set({ 
        status: "PAUSED",
        updatedAt: new Date() // Optional: update the timestamp if you have it
      })
      .where(
        and(
          eq(repositories.id, id),
          eq(repositories.connectedBy, userIdentifier)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ message: "Repository paused successfully", repo: result[0] });
  } catch (error) {
    console.error("Pause API Error:", error);
    return NextResponse.json({ error: "Failed to pause repository" }, { status: 500 });
  }
}