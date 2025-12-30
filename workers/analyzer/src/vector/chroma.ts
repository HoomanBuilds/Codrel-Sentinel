import { CloudClient } from "chromadb";
import { genai } from "../gemini/client";
import { withGeminiLimit } from "../limiter";

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY!,
  tenant: 'b38e086a-8303-4c32-b264-8392cf59f2d2',
  database: 'Sorxerer'
});

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  console.log(`${time} [${tag}] ${msg}`);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(
    texts.map(text => 
      withGeminiLimit(async () => {
        const res = await genai.models.embedContent({
          model: "text-embedding-004",
          contents: [{ role: "user", parts: [{ text }] }],
        });

        if (!res.embeddings?.[0]?.values) {
          throw new Error("Gemini embedding values missing");
        }
        return res.embeddings[0].values as number[];
      })
    )
  );
}

export async function upsertVectorsBatch(
  collectionName: string,
  items: { id: string; text: string; metadata: any }[]
) {
  if (items.length === 0) return;

  log("vector", `starting batch upsert | size=${items.length}`);

  const col = await client.getOrCreateCollection({
    name: toCollectionName(collectionName),
    embeddingFunction: null, 
  });

  const texts = items.map(i => i.text);
  
  log("gemini", `generating embeddings | count=${texts.length}`);
  const vectors = await embedBatch(texts);

  await col.upsert({
    ids: items.map(i => i.id),
    embeddings: vectors,
    documents: texts,
    metadatas: items.map(i => i.metadata),
  });

  log("vector", `batch completed | collection=${collectionName} upserted=${items.length}`);
}

function toCollectionName(repo: string) {
  return repo.replace(/[^a-zA-Z0-9._-]/g, "_");
}
