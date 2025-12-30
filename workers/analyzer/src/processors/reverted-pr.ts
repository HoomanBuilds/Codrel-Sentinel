import { z } from "zod";
import { GLOBAL_MODEL } from "@/lib/constants";
import { withGeminiLimit } from "../limiter";
import { upsertVectorsBatch } from "../vector/chroma";
import { generateText } from "@/gemini/generate";
import { FileRiskEvent } from "@/lib/db/record_file_event";

const RevertAnalysisSchema = z.object({
  summary: z.string(),
  revert_cause: z.string(),
  stability_risk: z.enum(["high", "medium", "low"]),
  risk_category: z.enum([
    "logic_error",
    "performance",
    "security",
    "ui_regression",
    "build_failure",
  ]),
  prevention_tip: z.string(),
  primary_file: z.string(),
  affected_files: z.array(z.string()),
});
type RevertAnalysis = z.infer<typeof RevertAnalysisSchema>;

const RevertJSONSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    revert_cause: { type: "string" },
    stability_risk: { type: "string", enum: ["high", "medium", "low"] },
    risk_category: {
      type: "string",
      enum: ["logic_error", "performance", "security", "ui_regression", "build_failure"],
    },
    prevention_tip: { type: "string" },
    primary_file: { type: "string" },
    affected_files: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "revert_cause",
    "stability_risk",
    "risk_category",
    "prevention_tip",
    "primary_file",
    "affected_files",
  ],
};

type RevertedPR = {
  repo: string;
  pr: {
    number: number;
    title: string;
    body: string;
    merge_commit_sha?: string;
    revert_confidence?: number;
    created_at : string;
  };
  diff: string;
  comments: any;
};

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

async function analyzeRevert(item: RevertedPR): Promise<RevertAnalysis> {
  return withGeminiLimit(async () => {
    const commentsText = Array.isArray(item.comments)
      ? item.comments
          .map((c: any) => `${c.author || "unknown"}: ${c.body}`)
          .join("\n")
      : typeof item.comments === "string"
      ? item.comments
      : "No comments available";

    const prompt = `
    You are a Lead Stability Engineer analyzing a "Reverted PR".
    This code was merged but later found to be defective and reverted.
    
    GOAL: Identify the regression or bug that caused the revert so we can warn future developers.

    CONTEXT:
    - Repo: ${item.repo}
    - PR Title: ${item.pr.title}
    
    PR BODY (Original Intent):
    ${item.pr.body}

    CODE DIFF (The Defective Code):
    ${item.diff.slice(0, 3000)}

    COMMENTS / SIGNALS:
    ${commentsText.slice(0, 2000)}

    TASK:
    1. Infer why this was reverted (Look for clues like "crash", "broken", "bug").
    2. If no explicit reason is found, analyze the diff for obvious bugs (e.g. valid syntax but wrong logic).
    3. Return structured JSON.
    `;

    const SPECIFIC_MODEL = null;
    const rawText = await generateText(
      SPECIFIC_MODEL || GLOBAL_MODEL || "gemini-2.0-flash",
      prompt,
      RevertJSONSchema
    );

    if (!rawText) throw new Error("Gemini returned empty response");

    try {
      return RevertAnalysisSchema.parse(JSON.parse(rawText));
    } catch (e) {
      console.error("Failed to parse Revert Analysis JSON:", rawText);
      throw e;
    }
  });
}

export async function processRevertedPrs(repo: string, prs: RevertedPR[] , eventBuffer: FileRiskEvent[]) {
  log(
    "revert-processor",
    `analyzing reverted PRs | repo=${repo} count=${prs.length}`
  );

  const vectorBatch: { id: string; text: string; metadata: any }[] = [];

  for (const item of prs) {
    try {
      const analysis = await analyzeRevert(item);

      const searchableText = `
REGRESSION WARNING: Reverted PR #${item.pr.number}
REPO: ${repo}
CAUSE: ${analysis.revert_cause}

# WHAT FAILED
${analysis.summary}

# RISK ANALYSIS
Category: ${analysis.risk_category}
Severity: ${analysis.stability_risk}

# HOW TO PREVENT
${analysis.prevention_tip}

# ORIGINAL CONTEXT
${item.pr.title}
      `.trim();

      vectorBatch.push({
        id: `${repo}-PR-${item.pr.number}-REVERTED`,
        text: searchableText,
        metadata: {
          repo,
          type: "reverted_pr",
          pr_number: item.pr.number,
          risk: analysis.stability_risk,
          category: analysis.risk_category,
        },
      });

      eventBuffer.push({
        repo,
        file_path: analysis.primary_file,
        affected_files: analysis.affected_files,
        event_type: "reverted_pr",
        event_source_id: String(item.pr.number),
        severity_score:
          analysis.stability_risk === "high" ? 0.9 :
          analysis.stability_risk === "medium" ? 0.6 : 0.3,
        severity_label: analysis.stability_risk,
        risk_category: analysis.risk_category,
        summary: analysis.revert_cause,
        raw_payload: analysis,
        created_at : item.pr.created_at,
      });
    } catch (e) {
      log(
        "revert-processor",
        `failed to analyze revert PR #${item.pr.number}: ${e}`
      );
    }
  }

  if (vectorBatch.length > 0) {
    await upsertVectorsBatch(repo, vectorBatch);
  }

  log(
    "revert-processor",
    `completed | repo=${repo} vectors=${vectorBatch.length}`
  );
}
