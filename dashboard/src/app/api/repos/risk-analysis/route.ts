import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, asc } from "drizzle-orm";
import { analyzeFileRisk, RiskTier } from "@/lib/risk_handler/risk-analysis";
import { buildContextByTier, createSummedUpPrompt } from "@/lib/risk_handler/handler";
import { db } from "@/lib/db";
import { repoFileEvents } from "@/lib/schema";
import { requireToken, RiskContextResponse, toFileRiskEvent } from "./utils";

type LogLevel = "info" | "warn" | "error";
const log = (l: LogLevel, m: string) => {
  const t = new Date().toISOString().replace("T", " ").split(".")[0];
  console.log(`${t} [${l}] ${m}`);
};

export async function POST(req: NextRequest) {
  try { await requireToken(req); }
  catch (e: any) {
    log("warn", `auth failed | ${e.message}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { repo, files, change } = body;
  if (!repo || !Array.isArray(files) || !files.length || !change)
    return NextResponse.json(
      { error: "repo, files[], and change are required" },
      { status: 400 }
    );

  const cleanFiles = files.map((f: string) => f.trim()).filter(Boolean);
  if (!cleanFiles.length)
    return NextResponse.json({ error: "No valid files provided" }, { status: 400 });

  let rows;
  try {
    rows = await db
      .select()
      .from(repoFileEvents)
      .where(
        and(
          eq(repoFileEvents.repo, repo),
          inArray(repoFileEvents.filePath, cleanFiles)
        )
      )
      .orderBy(asc(repoFileEvents.createdAt));
  } catch (e: any) {
    log("error", `db query failed | repo=${repo} | ${e.message}`);
    return NextResponse.json(
      { error: "Failed to load repository events" },
      { status: 500 }
    );
  }

  const byFile = new Map<string, typeof rows>();
  for (const r of rows) {
    const l = byFile.get(r.filePath);
    l ? l.push(r) : byFile.set(r.filePath, [r]);
  }

  const results: RiskContextResponse[] = []; 

for (const file of cleanFiles) {
  try {
    const events = (byFile.get(file) ?? []).map(toFileRiskEvent);
    const risk = analyzeFileRisk(file, events);
    const ctx = await buildContextByTier(repo, file, risk, events, change);
    results.push(ctx);
  } catch (e: any) {
    log("warn", `context failed | repo=${repo} | file=${file} | ${e.message}`);
    
    results.push({
      file_path: file,
      risk_score: 0,
      tier: "ignorable" as RiskTier,
      context: "Risk analysis unavailable due to internal context error.",
    });
  }
}

const finalPrompt = createSummedUpPrompt(repo, change, results);
  log("info", `risk-analysis completed | repo=${repo} files=${results.length}`);

  return NextResponse.json({
    repo,
    change,
    count: results.length,
    context : createSummedUpPrompt(repo, change, results),
    results,
  });
}
