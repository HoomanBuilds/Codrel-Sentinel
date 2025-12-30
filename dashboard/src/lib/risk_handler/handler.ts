import { FileRiskResult, RiskTier } from "@/lib/risk_handler/risk-analysis";
import { FileRiskEvent } from "@/app/api/repos/risk-analysis/utils";
import { CloudClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, msg: string) {
  const time = new Date().toISOString().replace("T", " ").split(".")[0];
  console.log(`${time} [${level}] ${msg}`);
}

class EmbeddingError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "EmbeddingError";
  }
}

class VectorError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "VectorError";
  }
}

export const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY!,
  tenant: "b38e086a-8303-4c32-b264-8392cf59f2d2",
  database: "Sorxerer",
});

type RiskContextResponse = {
  file_path: string;
  risk_score: number;
  tier: RiskTier;
  context: string;
  sources?: {
    workflow?: number;
    prs?: number;
    issues?: number;
    files?: number;
  };
};

async function embed(text: string): Promise<number[]> {
  try {
    const res = await genai.models.embedContent({
      model: "text-embedding-004",
      contents: [{ role: "user", parts: [{ text }] }],
    });

    const values = res.embeddings?.[0]?.values;
    if (!values) throw new Error("embedding values missing");

    return values;
  } catch (e: any) {
    log("error", `embedding failed: ${e.message}`);
    throw new EmbeddingError("Failed to generate embedding");
  }
}

async function vectorSearch(
  repo: string,
  query: string,
  where: any,
  limit: number
) {
  const collectionName = repo.replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const embedding = await embed(query);

    const col = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: null,
    });

    return await col.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      where,
    });
  } catch (e: any) {
    log(
      "warn",
      `vector search skipped | repo=${repo} | reason=${e.message}`
    );
    throw new VectorError("Vector context unavailable");
  }
}

export async function buildContextByTier(
  repo: string,
  file: string,
  result: FileRiskResult,
  events: FileRiskEvent[],
  change: string
): Promise<RiskContextResponse> {
  try {
    switch (result.tier) {
      case "ignorable":
        return ignorableContext(file, result);

      case "normal":
        return normalContext(file, result, events);

      case "need_context":
        return await needContext(repo, file, result, change);

      case "deep_context":
        return await deepContext(repo, file, result, change);

      case "advanced_context_retrieval":
        return await advancedContext(repo, file, result, change);

      default:
        throw new Error(`Unknown risk tier: ${result.tier}`);
    }
  } catch (e: any) {
    log(
      "warn",
      `context fallback | file=${file} | tier=${result.tier} | reason=${e.message}`
    );

    return {
      file_path: file,
      risk_score: result.final_risk_score,
      tier: result.tier,
      context: "Risk detected, but historical context is unavailable.",
    };
  }
}

function ignorableContext(
  file: string,
  result: FileRiskResult
): RiskContextResponse {
  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `Stability Analysis: CLEAN.\nNo recent crashes, reversions, or negative signals detected for ${file}.`,
  };
}

function normalContext(
  file: string,
  result: FileRiskResult,
  events: FileRiskEvent[]
): RiskContextResponse {
  const keywords = result.signals.top_keywords.slice(0, 3).join(", ");
  const recentSummary = events
    .slice(-3)
    .map((e) => `• [${e.event_type}] ${e.summary || "No details"}`)
    .join("\n");

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Stability Analysis: LOW RISK.
Existing signals are minor or decayed over time.

• Dominant Signal: ${result.signals.dominant_event_type || "None"}
• Related Keywords: ${keywords || "None"}
• Recent Activity:
${recentSummary || "No recent relevant events."}
`.trim(),
  };
}

async function needContext(
  repo: string,
  file: string,
  result: FileRiskResult,
  change: string
): Promise<RiskContextResponse> {
  const vectors = await vectorSearch(
    repo,
    `Failures or bugs in ${file}. Context: ${change}`,
    { type: { $in: ["workflow_crash", "reverted_pr"] } },
    5
  );

  const docs = vectors.documents?.[0] || [];
  const history = docs.length > 0 
    ? docs.map(d => `> "${(d || "").slice(0, 200)}..."`).join("\n") 
    : "No exact matches found, but file metrics indicate volatility.";

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Stability Analysis: MODERATE RISK.
This file has a history of contributing to workflow instability.

• Volatility Score: ${result.components.instability_score.toFixed(2)}
• Primary Risk: ${result.signals.dominant_event_type}

**Relevant Historical Incidents:**
${history}
`.trim(),
    sources: { workflow: 1, prs: 1 },
  };
}

async function deepContext(
  repo: string,
  file: string,
  result: FileRiskResult,
  change: string
): Promise<RiskContextResponse> {
  const vectors = await vectorSearch(
    repo,
    `Complex bugs, architecture violations, or reverts involving ${file}. Change: ${change}`,
    {
      type: {
        $in: ["workflow_crash", "reverted_pr", "rejected_pr", "issue"],
      },
    },
    10
  );

  const docs = vectors.documents?.[0] || [];
  const history = docs.length > 0
    ? docs.map((d, i) => `${i + 1}. ${(d || "").replace(/\n/g, " ")}`).join("\n")
    : "High algorithmic risk score detected, though vector history is sparse.";

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Stability Analysis: HIGH RISK.
This file is a frequent point of failure. Strict review required.

• Severity Entropy: ${result.components.severity_entropy.toFixed(2)} (High variance in failure types)
• Top Keywords: ${result.signals.top_keywords.join(", ")}

**Detailed Failure History:**
${history}
`.trim(),
    sources: { workflow: 1, prs: 1, issues: 1 },
  };
}

async function advancedContext(
  repo: string,
  file: string,
  result: FileRiskResult,
  change: string
): Promise<RiskContextResponse> {
  const vectors = await vectorSearch(
    repo,
    `Deep architectural analysis and regression history for ${file}. Change: ${change}`,
    {},
    15
  );

  const docs = vectors.documents?.[0] || [];
  
  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Stability Analysis: CRITICAL / ARCHITECTURAL RISK.
Changes to this file historically result in cascading failures or regressions.

**Risk Metrics:**
• Recency Weighted Risk: ${result.components.recency_weighted_risk.toFixed(2)}
• Correlation Score: ${result.components.correlation_score.toFixed(2)} (High coupling)

**Comprehensive Evidence:**
${docs.map(d => `- ${d}`).join("\n\n")}
`.trim(),
    sources: { workflow: 1, prs: 1, issues: 1, files: 1 },
  };
}


export function createSummedUpPrompt(
  repo: string,
  change: string,
  results: RiskContextResponse[]
): string {
  
  const criticalFiles = results
    .filter(r => r.risk_score > 0.6)
    .map(r => r.file_path);

  const fileContexts = results.map(r => {
    return `
### FILE: ${r.file_path}
**Risk Tier:** ${r.tier.toUpperCase()} (Score: ${r.risk_score.toFixed(2)})
**Analysis Context:**
${r.context}
    `.trim();
  }).join("\n\n---\n\n");

  return `
## INPUT DATA
**Proposed Change:** ${change}
**Critical Files Involved:** ${criticalFiles.length > 0 ? criticalFiles.join(", ") : "None detected"}

## HISTORICAL RISK CONTEXT (Database & Vector Search Results)
The following is a retrieval of past incidents, crashes, and revert logs associated with the files in this PR.

${fileContexts}
1. **Correlate:** logic in the "Proposed Change" with the "Historical Incidents" listed above.
2. **Verify:** If a file has high risk but the change is trivial (e.g., whitespace), downplay the risk.
3. **Warn:** If the change touches code paths mentioned in the "Detailed Failure History", issue a specific warning.
`.trim();
}