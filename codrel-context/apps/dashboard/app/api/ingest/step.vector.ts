import { createVectorStore } from "../../../lib/db/vectorDB";
import { createEmbeddings } from "../../../lib/langchain/service";
import type { IngestContext } from "./orchestrator";
import crypto from "crypto";

function sanitizeMetadata(meta: Record<string, unknown>) {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      out[key] = value.join(",");
    } else if (typeof value === "object" && value !== null) {
      out[key] = JSON.stringify(value);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

export async function stepVector(ctx: IngestContext) {
  const store = createVectorStore(ctx, createEmbeddings());
  const mode = ctx.cloud

  const contents = ctx.chunks.map(
    (c) =>
      `FILE: ${c.relativePath}\nTYPE: ${c.extension}\nLINES: ${c.startLine}-${c.endLine}\n---\n${c.text}`
  );

  const metadataList = ctx.chunks.map((c) =>
    sanitizeMetadata({
      id: c.id,
      relativePath: c.relativePath,
      extension: c.extension,
      language: c.language,
      startLine: c.startLine,
      endLine: c.endLine,
      treePath: c.treePath,
      tokenLength: c.tokenLength,
      source: c.source,
      sourceType: c.sourceType,
      docId: ctx.projectId,
      email: ctx.userEmail,
      mode,
    })
  );

  const ids = ctx.chunks.map((c) => c.id || crypto.randomUUID());

  try {
    const vectors = await store.embeddings.embedDocuments(contents);

    const docs = metadataList.map((meta, i) => ({
      pageContent: mode ? (contents[i] ?? "") : "",
      metadata: meta,
    }));

    await store.addVectors(vectors, docs, { ids });
  } catch (err) {
    console.error("Vector ingest failed:", err);

    try {
      await deleteChromaForProject(ctx.projectId!);
    } catch (cleanupErr) {
      console.error("Cleanup delete failed:", cleanupErr);
    }

    throw err;
  }
}

async function deleteChromaForProject(projectId: string) {
  const embeddings = createEmbeddings();
  const store = createVectorStore({ projectId }, embeddings);

  try {
    await store.ensureCollection();
    await store.index?.deleteCollection({ name: store.collectionName });
  } catch (err) {
    if (
      (err as Error).message?.includes("not found") ||
      (err as Error).message?.includes("does not exist")
    ) {
      return;
    }
    throw err;
  }
}
