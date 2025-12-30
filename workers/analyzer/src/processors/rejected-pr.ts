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
    created_at : string;
  };

};

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

async function analyzeRejectedPr(item: RejectedPR): Promise<PrAnalysis> {
  return withGeminiLimit(async () => {
    const humanComments = item.pr.comments
      .filter((c: any) => c.author_type !== "bot")
      .map((c: any) => `${c.author}: "${c.body}"`)
      .join("\n");

    const prompt = `
    You are a Senior Engineering Manager performing a "Post-Mortem" on a rejected Pull Request.
    
    Analyze why this code was rejected.
    
    CONTEXT:
    - Repo: ${item.repo}
    - PR Title: ${item.pr.title}
    - Type: ${item.pr.rejection_reason} rejection
    
    PR DESCRIPTION:
    ${item.pr.body}
    
    REJECTION DISCUSSION (Comments):
    ${
      humanComments ||
      "(No human comments found - likely rejected silently or by bot)"
    }
    
    DIFF SNIPPET (What changed):
    ${item.pr.diff ? item.pr.diff.slice(0, 2000) : "No diff available"}
    
    TASK:
    1. Determine the root cause of rejection.
    2. Extract lessons learned.
    3. Return structured JSON.
    `;

    const SPECIFIC_MODEL = null;
    const rawText = await generateText(
      SPECIFIC_MODEL || GLOBAL_MODEL || "gemini-2.0-flash",
      prompt,
      RejectJSONSchema
    );

    if (!rawText) throw new Error("Gemini returned empty response");

    try {
      return PrAnalysisSchema.parse(JSON.parse(rawText));
    } catch (e) {
      console.error("Failed to parse PR Analysis JSON:", rawText);
      throw e;
    }
  });
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
    try {
      const analysis = await analyzeRejectedPr(item);

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
        raw_payload: analysis,
        created_at : item.pr.created_at,
      });
    } catch (e) {
      log("pr-processor", `failed to analyze PR #${item.pr.number}: ${e}`);
    }
  }

  if (vectorBatch.length > 0) {
    await upsertVectorsBatch(repo, vectorBatch);
  }

  log("pr-processor", `completed | repo=${repo} vectors=${vectorBatch.length}`);
}
