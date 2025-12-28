import z from "zod";
import { RagService } from "./RAG.js";


export const getCodrelTools = (token: string, options: { pick: number }) => {
  return {
    getContext: {
      tool: {
        title: "RAG : Context Fetcher",
        description:
          "Fetch and build prompt for RAG. The AI agent must rewrite the user's question into a highly effective hybrid-search query. Extract intent, add technical synonyms, include API names, method names, errors, keywords, and file names. Remove fluff. Output a single optimized query string designed for vector + BM25 retrieval.",
        inputSchema: {
          collectionId: z.string(),
          RaqQuery: z.string().describe("The query to fetch relevant context for. enhance user query and pick relevant info so that retrieval is effective."),
        },
      },

      handler: async ({ collectionId, RaqQuery }: { collectionId: string; RaqQuery: string }) => {
        if (!collectionId) {
          return {
            content: [{ type: "text", text: "RAG error: collectionId is required." }],
          };
        }
        const rag = new RagService(collectionId, token);
        await rag.init();

        try {
          const results = await rag.fetchRetrievals(collectionId, RaqQuery);
          const filtered = await rag.filterRetrieval(results, RaqQuery);

          const prompt = rag.createContextPrompt(filtered as any, options.pick);

          return {
            content: [{ type: "text", text: prompt }],
          };
        } catch (e) {
          return {
            content: [
              { type: "text", text: `RAG error: ${e instanceof Error ? e.message : e}` },
            ],
          };
        }
      },
    },
  }
}
