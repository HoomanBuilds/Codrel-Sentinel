import { z } from "zod";
import { GLOBAL_MODEL } from "@/lib/constants";
import { upsertVectorsBatch } from "../vector/chroma";
import { generateText } from "@/gemini/generate";

const ArchitectureSchema = z.object({
  summary: z.string(),
  key_concepts: z.array(z.string()),
  exports: z.array(z.string()),
  dependencies: z.array(z.string()),
  logic_flow: z.string(),
});

const ArchJSONSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    key_concepts: { type: "array", items: { type: "string" } },
    exports: { type: "array", items: { type: "string" } },
    dependencies: { type: "array", items: { type: "string" } },
    logic_flow: { type: "string" },
  },
  required: ["summary", "key_concepts", "exports", "dependencies", "logic_flow"],
};

type FileNode = {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
};

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

async function generateRagSummary(file: FileNode) {
  const prompt = `
  You are a Senior Software Architect optimizing code for a RAG system.
  Analyze this source file and generate a structured JSON summary.
  
  FILE INFO:
  - Path: ${file.path}
  - Language: ${file.language}
  
  SOURCE CODE:
  ${file.content.slice(0, 15000)}
  `;

  const LOCAL_MODEL = null
  const rawText = await generateText(
    LOCAL_MODEL || GLOBAL_MODEL || "gemini-2.0-flash",
    prompt,
    ArchJSONSchema
  );

  try {
    return ArchitectureSchema.parse(JSON.parse(rawText));
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", rawText);
    throw e;
  }
}

export async function processArchitecture(repo: string, files: FileNode[]) {
  log("arch-processor", `analyzing architecture | repo=${repo} files=${files.length}`);

  const codeFiles = files.filter(f => 
    !f.path.includes("lock") && 
    !f.path.endsWith(".png") &&
    !f.path.endsWith(".svg") &&
    f.size > 0
  );

  const vectorBatch: { id: string; text: string; metadata: any }[] = [];
  const CHUNK_SIZE = 5;

  for (let i = 0; i < codeFiles.length; i += CHUNK_SIZE) {
    const chunk = codeFiles.slice(i, i + CHUNK_SIZE);
    
    const promises = chunk.map(async (file) => {
      try {
        const analysis = await generateRagSummary(file);
        
        const searchableText = `
FILE: ${file.path}
LANGUAGE: ${file.language}

# SUMMARY
${analysis.summary}

# KEY CONCEPTS
${analysis.key_concepts.join(", ")}

# EXPORTS
${analysis.exports.join(", ")}

# DEPENDENCIES
${analysis.dependencies.join(", ")}

# LOGIC FLOW
${analysis.logic_flow}

# RAW CONTENT SNIPPET
${file.content.slice(0, 1000)}...
        `.trim();

        return {
          id: `${repo}-FILE-${file.path.replace(/\//g, "_")}`, 
          text: searchableText,
          metadata: {
            repo,
            type: "file",
            path: file.path,
            language: file.language,
            size: file.size,
          }
        };
      } catch (e) {
        log("arch-processor", `failed to analyze ${file.path}: ${e}`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    results.forEach(r => { if (r) vectorBatch.push(r); });
    log("arch-processor", `analyzed chunk ${i + 1}-${Math.min(i + CHUNK_SIZE, codeFiles.length)}`);
  }

  if (vectorBatch.length > 0) {
    await upsertVectorsBatch(repo, vectorBatch);
  }

  log("arch-processor", `completed | repo=${repo} vectors=${vectorBatch.length}`);
}