import { db } from "@/lib/db";
import { tokensTable } from "@/lib/schema";
import { eq } from "drizzle-orm";

export function toFileRiskEvent(row: any): FileRiskEvent {
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

export async function requireToken(req: Request) {
  const auth = req.headers.get("authorization");

  if (!auth?.startsWith("Bearer ")) {
    throw new Error("Missing token");
  }

  const token = auth.slice(7).trim();

  const rows = await db
    .select({ id: tokensTable.id })
    .from(tokensTable)
    .where(eq(tokensTable.token, token))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Invalid token");
  }

  return token;
}
