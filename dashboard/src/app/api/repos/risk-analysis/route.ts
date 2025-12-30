import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, asc } from "drizzle-orm";
import { analyzeFileRisk } from "./risk-analysis"
import { db } from "@/lib/db"; 
import { repoFileEvents } from "@/lib/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const repo = searchParams.get("repo");
  const filesParam = searchParams.get("files");

  if (!repo) {
    return NextResponse.json(
      { error: "Missing repo param" },
      { status: 400 }
    );
  }

  if (!filesParam) {
    return NextResponse.json(
      { error: "Missing files param" },
      { status: 400 }
    );
  }

  const files = filesParam
    .split(",")
    .map(f => f.trim())
    .filter(Boolean);

  if (!files.length) {
    return NextResponse.json(
      { error: "No valid files provided" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(repoFileEvents)
    .where(
      and(
        eq(repoFileEvents.repo, repo),
        inArray(repoFileEvents.filePath, files)
      )
    )
    .orderBy(asc(repoFileEvents.createdAt));

  const byFile = new Map<string, typeof rows>();

  for (const row of rows) {
    const list = byFile.get(row.filePath);
    if (list) list.push(row);
    else byFile.set(row.filePath, [row]);
  }

  const results = files.map(file => {
    const rowsForFile = byFile.get(file) ?? [];
    const events = rowsForFile.map(toFileRiskEvent);
    return analyzeFileRisk(file, events);
  });

  return NextResponse.json({
    repo,
    count: results.length,
    results,
  });
}

function toFileRiskEvent(row: any): FileRiskEvent {
  return {
    repo: row.repo,
    file_path: row.filePath,
    affected_files: row.affectedFiles ?? undefined,

    event_type: row.eventType,
    event_source_id: row.eventSourceId ?? undefined,

    severity_score: row.severityScore,
    severity_label: row.severityLabel ?? undefined,

    risk_category: row.riskCategory ?? undefined,
    keywords: row.keywords ?? undefined,
    summary: row.summary ?? undefined,

    created_at: row.createdAt,
    raw_payload: row.rawPayload,
  }
}

export type FileRiskEvent = {
  repo: string;

  file_path: string;
  affected_files?: string[];

  event_type:
    | "workflow_crash"
    | "reverted_pr"
    | "rejected_pr"
    | "architecture";

  event_source_id?: string;

  severity_score: number;
  severity_label?: "low" | "medium" | "high" | "critical";

  risk_category?: string;
  keywords?: string[];
  summary?: string;
  created_at : string;
  raw_payload: unknown;
};