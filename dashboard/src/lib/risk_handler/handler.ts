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
    context: `No significant risk signals detected for ${file}.`,
  };
}

function normalContext(
  file: string,
  result: FileRiskResult,
  events: FileRiskEvent[]
): RiskContextResponse {
  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Minor risk signals detected.

Dominant signal:
- ${result.signals.dominant_event_type ?? "none"}

Recent events:
${events
  .slice(-2)
  .map((e) => `- ${e.summary ?? "no summary"}`)
  .join("\n")}
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
    `Recent issues related to ${file}. Change: ${change}`,
    { type: { $in: ["workflow_crash", "reverted_pr", "rejected_pr"] } },
    6
  );

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Risk detected due to instability.

Relevant history:
${vectors.documents?.[0]?.join("\n\n") ?? "No context found."}
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
    `Historical risk patterns for ${file}. Change: ${change}`,
    {
      type: {
        $in: ["workflow_crash", "reverted_pr", "rejected_pr", "issue"],
      },
    },
    12
  );

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
Persistent instability detected.

Signals:
${vectors.documents?.[0]?.slice(0, 8).join("\n\n") ?? "No data."}
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
    `Deep historical analysis for ${file}. Change: ${change}`,
    {},
    25
  );

  const docs = vectors.documents?.[0] ?? [];

  return {
    file_path: file,
    risk_score: result.final_risk_score,
    tier: result.tier,
    context: `
High confidence risk.

This file has long-term instability correlated with failures.

Evidence:
${docs.slice(0, 10).join("\n\n")}
`.trim(),
    sources: { workflow: 1, prs: 1, issues: 1, files: 1 },
  };
}
