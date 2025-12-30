import { pool } from "./db";

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

export async function recordFileEventsBatch(
  events: FileRiskEvent[]
) {
  if (!events.length) return;

  const values: any[] = [];
  const rows = events.map((e, i) => {
    const o = i * 10;
    values.push(
      e.repo,
      e.file_path,
      e.event_type,
      e.event_source_id ?? null,
      e.severity_score,
      e.severity_label ?? null,
      e.risk_category ?? null,
      e.keywords ?? null,
      e.summary ?? null,
      JSON.stringify(e.raw_payload)
    );

    return `(
      $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4},
      $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8},
      $${o + 9}, $${o + 10}
    )`;
  });

  const sql = `
    INSERT INTO repo_file_events (
      repo,
      file_path,
      event_type,
      event_source_id,
      severity_score,
      severity_label,
      risk_category,
      keywords,
      summary,
      raw_payload
    )
    VALUES ${rows.join(",")}
  `;

  await pool.query(sql, values);
}
