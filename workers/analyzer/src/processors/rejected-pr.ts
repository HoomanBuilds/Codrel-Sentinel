import { z } from "zod";
import { GLOBAL_MODEL } from "@/lib/constants";
import { withGeminiLimit } from "../limiter";
import { upsertVectorsBatch } from "../vector/chroma";
import { generateText } from "@/gemini/generate";
import { FileRiskEvent } from "@/lib/db/record_file_event";

const PrAnalysisSchema = z.object({
  summary: z.string(),
  rejection_reason: z.string(),
  improvement_suggestion: z.string(),
  risk_keywords: z.array(z.string()),
  sentiment: z.enum(["neutral", "harsh", "constructive"]),
  primary_file: z
    .string()
    .describe(
      "The single most responsible file for this rejection. Use 'unknown' if unclear."
    ),

  affected_files: z
    .array(z.string())
    .describe(
      "List of files involved or impacted by this PR. Can be empty if unclear."
    ),
});

type PrAnalysis = z.infer<typeof PrAnalysisSchema>;

const RejectJSONSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    rejection_reason: { type: "string" },
    improvement_suggestion: { type: "string" },
    risk_keywords: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    sentiment: { type: "string", enum: ["neutral", "harsh", "constructive"] },
    primary_file: {
      type: "string",
      description: "Main file responsible, or 'unknown'.",
    },
    affected_files: {
      type: "array",
      items: { type: "string" },
      description: "Other involved files.",
    },
  },
  required: [
    "summary",
    "rejection_reason",
    "improvement_suggestion",
    "risk_keywords",
    "sentiment",
    "primary_file",
    "affected_files",
  ],
};

type RejectedPR = {
  repo: string;
  pr: {
    number: number;
    title: string;
    body: string;
    diff?: string;
    rejection_reason: string;
    comments: any[];
    created_at: string;
  };
};

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

export async function processRejectedPrs(
  repo: string,
  prs: RejectedPR[],
  eventBuffer: FileRiskEvent[]
) {
  log(
    "pr-processor",
    `analyzing rejected PRs | repo=${repo} count=${prs.length}`
  );

  const vectorBatch: { id: string; text: string; metadata: any }[] = [];

  for (const item of prs) {
    let analysis: PrAnalysis | null = null;
    try {
      analysis = await withGeminiLimit(() => analyzeRejectedPrOnce(item));

      const searchableText = `
PR REJECTED: ${item.pr.title}
REPO: ${repo}
REASON: ${analysis.rejection_reason}

# SUMMARY
${analysis.summary}

# LESSON LEARNED
${analysis.improvement_suggestion}

# RISK KEYWORDS
${analysis.risk_keywords.join(", ")}

# ORIGINAL CONTEXT
${item.pr.body.slice(0, 500)}
      `.trim();

      vectorBatch.push({
        id: `${repo}-PR-${item.pr.number}-REJECTED`,
        text: searchableText,
        metadata: {
          repo,
          type: "rejected_pr",
          pr_number: item.pr.number,
          reason: item.pr.rejection_reason,
          sentiment: analysis.sentiment,
        },
      });

      eventBuffer.push({
        repo,
        file_path: analysis.primary_file ?? "unknown",
        affected_files: analysis.affected_files ?? [],
        event_type: "rejected_pr",
        event_source_id: String(item.pr.number),

        severity_score:
          analysis.sentiment === "harsh"
            ? 0.6
            : analysis.sentiment === "neutral"
            ? 0.4
            : 0.2,

        severity_label: analysis.sentiment === "harsh" ? "medium" : "low",

        keywords: analysis.risk_keywords,
        summary: analysis.rejection_reason,
        raw_payload: JSON.stringify(analysis),
        created_at: item.pr.created_at,
      });
    } catch (e: any) {
      if (e.type === "RATE_LIMIT") {
        log("pr-processor", `Gemini quota hit | PR=${item.pr.number}`);
        continue;
      }

      if (e instanceof SyntaxError) {
        log("pr-processor", `Invalid JSON | PR=${item.pr.number}`);
        continue;
      }

      log("pr-processor", `AI failure | PR=${item.pr.number} err=${e}`);
      continue;
    }
    if (!analysis) continue;
  }

  if (vectorBatch.length > 0) {
    await upsertVectorsBatch(repo, vectorBatch);
  }

  log("pr-processor", `completed | repo=${repo} vectors=${vectorBatch.length}`);
}

async function analyzeRejectedPrOnce(item: RejectedPR): Promise<PrAnalysis> {
  const comments = Array.isArray(item.pr.comments) ? item.pr.comments : [];

  const humanComments = comments
    .filter((c: any) => c && c.author_type !== "bot")
    .map((c: any) => `${c.author ?? "unknown"}: "${c.body ?? ""}"`)
    .join("\n");

  const prompt = `
You are a Senior Engineering Manager performing a post-mortem on a rejected PR.

CONTEXT:
- Repo: ${item.repo}
- PR Title: ${item.pr.title}
- Type: ${item.pr.rejection_reason} rejection

PR DESCRIPTION:
${item.pr.body ? item.pr.body.slice(0, 500) : ""}

COMMENTS:
${humanComments || "(No human comments found)"}

DIFF:
${item.pr.diff ? item.pr.diff.slice(0, 2000) : "No diff available"}

TASK:
Return structured JSON only.
`;

  const rawText = await generateText(
    GLOBAL_MODEL || "gemini-2.0-flash-lite",
    prompt,
    RejectJSONSchema
  );

  const parsed = JSON.parse(rawText);
  return PrAnalysisSchema.parse(parsed);
}
