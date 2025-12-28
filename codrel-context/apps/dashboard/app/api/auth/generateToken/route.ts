import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "../../../../lib/authOption";
import db from "../../../../lib/db/db";
import { tokensTable } from "../../../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { logEvent } from "../../../../lib/analytics/logs";

export async function GET(req: Request) {
  const start = performance.now();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    void logEvent({
      event: "token_create",
      userEmail: "unknown",
      success: false,
      error: "unauthorized",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;
  const existing = await db.select().from(tokensTable).where(eq(tokensTable.email, email));

  const searchParams = new URL(req.url).searchParams;
  const keyName = searchParams.get("keyName");


  if (existing.length >= 10) {
    void logEvent({
      event: "token_create",
      userEmail: email,
      success: false,
      error: "limit_reached",
      metadata: {
        latency_ms: Math.round(performance.now() - start),
        existing_count: existing.length,
        limit: 10
      }
    });
    return NextResponse.json({ error: "Token limit reached (max 10)" }, { status: 400 });
  }

  const token = crypto.randomBytes(16).toString("hex");

  await db.insert(tokensTable).values({
    email,
    token,
    meta: { createdFrom: "dashboard", ua: "web" , keyName: keyName || "untitled" },
  });

  void logEvent({
    event: "token_create",
    userEmail: email,
    success: true,
    metadata: {
      keyName,
      latency_ms: Math.round(performance.now() - start),
      created_from: "dashboard",
      ua: "web",
      previous_count: existing.length
    }
  });

  return NextResponse.json({
    token,
    email,
    meta: { createdFrom: "dashboard", ua: "web" },
  });
}


export async function DELETE(req: Request) {
  const start = performance.now();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    void logEvent({
      event: "token_delete",
      userEmail: "unknown",
      success: false,
      error: "unauthorized",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email!;
  const searchParams = new URL(req.url).searchParams;
  const token = searchParams.get("token");

  if (!token) {
    void logEvent({
      event: "token_delete",
      userEmail: email,
      success: false,
      error: "missing_token",
      metadata: { latency_ms: Math.round(performance.now() - start) }
    });
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await db
    .delete(tokensTable)
    .where(and(eq(tokensTable.email, email), eq(tokensTable.token, token)));

  void logEvent({
    event: "token_delete",
    userEmail: email,
    success: true,
    metadata: {
      latency_ms: Math.round(performance.now() - start),
      token_deleted: true
    }
  });

  return NextResponse.json({ success: true, deleted: result });
}