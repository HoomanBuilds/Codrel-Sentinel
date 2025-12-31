import type { FullChunk, RetrievedChunk, ScoringWeights } from "../types.js";
import { BALANCED_WEIGHTS } from "../utils/constants.js";
import { type ScoredChunk, scoreAll } from "./scoring-core.js";
import bm25 from "wink-bm25-text-search";

export interface PreprocessOptions {
  retrievedChunks: RetrievedChunk[];
  fullChunks?: Map<string, FullChunk>;
  query: string;
  topK?: number | null;
  tokenMax?: number | null;
  weights?: ScoringWeights;
}

export function filterTopK(scored: ScoredChunk[], k: number): ScoredChunk[] {
  return scored
    .slice()
    .sort((a, b) => b._finalScore - a._finalScore)
    .slice(0, k);
}

export function filterByToken(
  scored: ScoredChunk[],
  tokenMax: number
): ScoredChunk[] {
  let acc = 0;
  const out: ScoredChunk[] = [];
  const sorted = scored.slice().sort((a, b) => b._finalScore - a._finalScore);

  for (const c of sorted) {
    const t = c.tokenLength || 0;
    if (acc + t > tokenMax) break;
    out.push(c);
    acc += t;
  }

  return out;
}

export function ProcessRetrieved(options: PreprocessOptions) {
  const {
    retrievedChunks,
    fullChunks,
    query,
    weights = BALANCED_WEIGHTS,
    tokenMax = null,
    topK = 5,
  } = options;

  // 1. VECTOR + METADATA
  let scored = scoreAll(retrievedChunks, query, weights);

  // 2. BM25 SPARSE INDEX
  const bm25Engine = bm25();
  
  // Configure BM25 before adding documents
  bm25Engine.defineConfig({ fldWeights: { body: 1 } });
  bm25Engine.definePrepTasks([
    (text: string) => text.toLowerCase().split(/\W+/).filter(Boolean)
  ]);

  for (const c of retrievedChunks) {
    const full = fullChunks?.get(c.id);

    const content =
      full?.pageContent ||
      full?.text ||
      c.pageContent || // IMPORTANT FIX
      "";

    if (content.trim().length > 0) {
      bm25Engine.addDoc({ body: content }, c.id);
    }
  }

  bm25Engine.consolidate();

  const bm25Results = bm25Engine.search(query);
  const bm25Map = new Map(bm25Results.map((r: any) => [r.id, r.score])); // FIXED

  // 3. HYBRID MERGE
  for (const c of scored) {
    const sparse = bm25Map.get(c.id) || 0;
    c._finalScore = (c._finalScore * 0.80) + (sparse * 0.20);
  }

  // 4. RANK FILTERS
  if (topK != null) scored = filterTopK(scored, topK);
  if (tokenMax != null) scored = filterByToken(scored, tokenMax);

  // 5. MERGE FULL CHUNKS
  return scored.map((s) => {
    const full = fullChunks?.get(s.id);
    return full ? { ...full, ...s } : s;
  });
}
