import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { repositories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdentifier =
    session?.user?.email || (session?.user as any)?.login;

  if (!session || !userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Repository id missing" },
      { status: 400 }
    );
  }

  const repo = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1);

  if (!repo.length) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 }
    );
  }

  if (repo[0].connectedBy !== userIdentifier) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  if (repo[0].status !== "PAUSED") {
    return NextResponse.json(
      { error: "Repository is not paused" },
      { status: 400 }
    );
  }

  await db
    .update(repositories)
    .set({
      status: "READY",
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id));

  return NextResponse.json({
    success: true,
    status: "READY",
  });
}
