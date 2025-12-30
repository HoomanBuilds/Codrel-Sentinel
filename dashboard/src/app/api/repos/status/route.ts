import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repositories } from "@/lib/schema";
import { eq } from "drizzle-orm";
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