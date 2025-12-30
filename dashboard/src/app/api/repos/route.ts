import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { repositories } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdentifier = session.user.email || (session.user as any).login;

  const rows = await db
    .select()
    .from(repositories)
    .where(eq(repositories.connectedBy, userIdentifier));

  return NextResponse.json({ repos: rows });
}
