import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, asc } from "drizzle-orm";
import { analyzeFileRisk, RiskTier } from "@/lib/risk_handler/risk-analysis";
import { buildContextByTier, createSummedUpPrompt } from "@/lib/risk_handler/handler";
import { db } from "@/lib/db";
import { repoFileEvents } from "@/lib/schema";
import { requireToken, RiskContextResponse, toFileRiskEvent } from "./utils";

type Mode = "score" | "full";

export async function POST(req: NextRequest) {
  try {
    await requireToken(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = (req.nextUrl.searchParams.get("mode") as Mode) ?? "full";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { repo, files, change } = body;
  if (!repo || !Array.isArray(files) || !files.length || !change) {
    return NextResponse.json(
      { error: "repo, files[], and change are required" },
      { status: 400 }
    );
  }

  const cleanFiles = files.map((f: string) => f.trim()).filter(Boolean);
  if (!cleanFiles.length) {
    return NextResponse.json({ error: "No valid files provided" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(repoFileEvents)
    .where(
      and(
        eq(repoFileEvents.repo, repo),
        inArray(repoFileEvents.filePath, cleanFiles)
      )
    )
    .orderBy(asc(repoFileEvents.createdAt));

  const byFile = new Map<string, typeof rows>();
  for (const r of rows) {
    const l = byFile.get(r.filePath);
    l ? l.push(r) : byFile.set(r.filePath, [r]);
  }

  if (mode === "score") {
    const scores = cleanFiles.map((file) => {
      const events = (byFile.get(file) ?? []).map(toFileRiskEvent);
      const risk = analyzeFileRisk(file, events);
      return {
        file_path: file,
        risk_score: risk.final_risk_score,
        tier: risk.tier as RiskTier,
      };
    });

    return NextResponse.json({
      repo,
      change,
      mode: "score",
      count: scores.length,
      results: scores,
    });
  }

  const results: RiskContextResponse[] = [];

  for (const file of cleanFiles) {
    try {
      const events = (byFile.get(file) ?? []).map(toFileRiskEvent);
      const risk = analyzeFileRisk(file, events);
      const ctx = await buildContextByTier(repo, file, risk, events, change);
      results.push(ctx);
    } catch {
      results.push({
        file_path: file,
        risk_score: 0,
        tier: "ignorable" as RiskTier,
        context: "Risk analysis unavailable due to internal error.",
      });
    }
  }

  return NextResponse.json({
    repo,
    change,
    mode: "full",
    count: results.length,
    context: createSummedUpPrompt(repo, change, results),
    results,
  });
}
