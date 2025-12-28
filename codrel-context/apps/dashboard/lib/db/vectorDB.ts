import { Embeddings } from "@langchain/core/embeddings";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { IngestContext } from "../../app/api/ingest/orchestrator";
import { Askcontext } from "../../app/api/ask/route";

export function createVectorStore(
  ctx: Askcontext | IngestContext | { projectId: string },
  embeddings: Embeddings
) {
  try {
    const vectorStore = new Chroma(embeddings, {
      collectionName: ctx.projectId!,
      chromaCloudAPIKey: process.env.CHROMA_API_KEY,
      clientParams: {
        host: "api.trychroma.com",
        port: 8000,
        ssl: true,
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
      },
    });

    return vectorStore;
  } catch (error) {
    throw new Error(`Error while creating Upstash vector store: ${error}`);
  }
}
