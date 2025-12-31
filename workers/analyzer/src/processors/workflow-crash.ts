import { z } from "zod";
import { KafkaMessage } from "kafkajs";
import { withGeminiLimit } from "../limiter";
import { upsertVectorsBatch } from "../vector/chroma";
import { GLOBAL_MODEL } from "@/lib/constants";
import { generateText } from "@/gemini/generate";
import { randomUUID } from "node:crypto";
import { FileRiskEvent } from "@/lib/db/record_file_event";

export function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

const AnalysisSchema = z.object({
  main_cause_file: z.string(),
  cause_files: z.array(z.string()),

  critical_score: z.number().min(0).max(1),
  critical_label: z.enum(["low", "medium", "high", "critical"]),
  critical_reason: z.string(),

  root_reason: z.string(),

  short_explanation: z.string(),
  detailed_explanation: z.string(),
  rag_summary: z.string(),
  keywords: z.array(z.string()),

  code_causing_issue: z.array(
    z.object({ file: z.string(), snippet: z.string() })
  ),
  code_update_suggestion: z.array(
    z.object({ file: z.string(), patch: z.string() })
  ),

  confidence: z.number().min(0).max(1),
});

type Analysis = z.infer<typeof AnalysisSchema>;

const CrashJSONSchema = {
  type: "object",
  properties: {
    main_cause_file: { type: "string" },
    cause_files: { type: "array", items: { type: "string" } },

    critical_score: { 
      type: "number",
      description: "A float value between 0.0 and 1.0 representing severity (e.g. 0.95).",
    },
    critical_label: {
      type: "string",
      enum: ["low", "medium", "high", "critical"],
    },
    critical_reason: { type: "string" },

    root_reason: { type: "string" },

    short_explanation: { type: "string" },
    detailed_explanation: { type: "string" },
    rag_summary: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },

    code_causing_issue: {
      type: "array",
      items: {
        type: "object",
        properties: { file: { type: "string" }, snippet: { type: "string" } },
        required: ["file", "snippet"],
      },
    },
    code_update_suggestion: {
      type: "array",
      items: {
        type: "object",
        properties: { file: { type: "string" }, patch: { type: "string" } },
        required: ["file", "patch"],
      },
    },

    confidence: { 
      type: "number",
      description: "Confidence score between 0.0 and 1.0.",
    },
  },
  required: [
    "main_cause_file",
    "cause_files",
    "critical_score",
    "critical_label",
    "critical_reason",
    "root_reason",
    "short_explanation",
    "detailed_explanation",
    "rag_summary",
    "keywords",
    "code_causing_issue",
    "code_update_suggestion",
    "confidence",
  ],
};

function buildPrompt(repo: string, crash: any) {
  return `
You are a Senior DevOps Engineer & CI/CD Specialist.
Analyze this workflow failure to determine the root cause and solution.

CONTEXT:
Repository: ${repo}
Workflow: ${crash.name} (Job: ${crash.job_name})
Branch: ${crash.branch}
Commit: "${crash.commit_msg}" (${crash.head_sha})

--- 1. ERROR SIGNATURE (The Symptom) ---
${crash.error_signature}

--- 2. RELEVANT LOG LINES ---
${
  Array.isArray(crash.error_lines)
    ? crash.error_lines.join("\n")
    : "No error lines available"
}

--- 3. RECENT CODE CHANGES (The Potential Cause) ---
${
  Array.isArray(crash.change?.files)
    ? crash.change.files
        .map(
          (f: any) =>
            `>>> FILE: ${f.filename}\n${
              f.patch ? f.patch.slice(0, 2000) : "(No patch content)"
            }`
        )
        .join("\n\n")
    : "(No changed files available)"
}

--- ANALYSIS INSTRUCTIONS ---
1. CORRELATION CHECK: specifically look for error line numbers in the logs that match lines modified in the 'Code Changes'.
2. CLASSIFY: Is this a Logic Error, Syntax Error, Dependency Issue, or Flaky Test?
3. SOLVE: Provide the exact code fix or git command needed.

--- OUTPUT FORMAT ---
Return STRICT JSON. Ensure "rag_summary" is optimized for vector search (include error keywords + filename).
`;
}

export async function processWorkflowCrash(
  msg: KafkaMessage,
  eventBuffer: FileRiskEvent[]
) {
  const payload = JSON.parse(msg.value!.toString());
  const repo = payload.repo;
  const crashes = payload.workflow_crash?.Crash ?? [];

  if (!crashes.length) {
    log("workflow", `no crashes | repo=${repo}`);
    return;
  }

  log("workflow", `processing crashes | repo=${repo} count=${crashes.length}`);

  const vectors: {
    id: string;
    text: string;
    metadata: Record<string, any>;
  }[] = [];

  for (const crash of crashes) {
    log("workflow", `analyzing crash=${crash.id}`);
    try {
      const result = await withGeminiLimit(() => analyzeCrashOnce(repo, crash));

      const vectorText = `
RAG Summary:
${result.rag_summary}

Root Cause:
${result.root_reason}

Detailed Explanation:
${result.detailed_explanation}

Fix Summary:

Code causing issue:
${result.code_causing_issue.map((c) => `${c.file}:\n${c.snippet}`).join("\n\n")}

Code update suggestion:
${result.code_update_suggestion
  .map((c) => `${c.file}:\n${c.patch}`)
  .join("\n\n")}

Keywords:
${result.keywords.join(", ")}
      `.trim();

      vectors.push({
        id: `workflow-crash-${repo}-${crash.id}-${randomUUID()}`,
        text: vectorText,
        metadata: {
          repo,
          crash_id: crash.id,
          workflow: crash.name,
          job: crash.job_name,
          branch: crash.branch,
          main_cause_file: result.main_cause_file,
          severity: result.critical_label,
          severity_score: result.critical_score,
          keywords: result.keywords,
          type: "workflow_crash",
        },
      });

      eventBuffer.push({
        repo,
        file_path:
          typeof result.main_cause_file === "string" &&
          result.main_cause_file.length > 0
            ? result.main_cause_file
            : "unknown",

        affected_files: Array.isArray(result.cause_files)
          ? result.cause_files
          : [],

        event_type: "workflow_crash",
        event_source_id: String(crash.id),

        severity_score: result.critical_score,
        severity_label: result.critical_label,

        keywords: result.keywords,
        summary: result.short_explanation,

        raw_payload: JSON.stringify(result),
        created_at: crash.created_at,
      });
    } catch (e: any) {
      if (e.type === "RATE_LIMIT") {
        log("workflow", `Gemini quota hit | crash=${crash.id}`);
        continue;
      }

      if (e instanceof SyntaxError) {
        log("workflow", `Invalid JSON | crash=${crash.id}`);
        continue;
      }

      log("workflow", `AI failure | crash=${crash.id} err=${e}`);
      continue;
    }
  }

  if (vectors.length > 0) {
    await upsertVectorsBatch(repo, vectors);
  }

  log("workflow", `completed | repo=${repo} vectors=${vectors.length}`);
}

async function analyzeCrashOnce(repo: string, crash: any): Promise<Analysis> {
  const prompt = buildPrompt(repo, crash);

  const rawText = await generateText(
    GLOBAL_MODEL || "gemini-2.0-flash-lite",
    prompt,
    CrashJSONSchema
  );

  const parsedJson = JSON.parse(rawText);
  return AnalysisSchema.parse(parsedJson);
}
