import type { RetrievedChunk, ScoringWeights } from "../types.js";
import { DOC_EXTS, CODE_EXTS } from "../utils/keywords.js";
import {
  basename,
  normalize,
  containsKeyword,
  deriveHints,
  normalizeSimilarity,
  tinyPathSpread,
} from "./scoring-helpers.js";

export interface ScoredChunk extends RetrievedChunk {
  _finalScore: number;
}

export function similarityScore(
  chunk: RetrievedChunk,
  w: ScoringWeights,
  hints: ReturnType<typeof deriveHints>
): number {
  const ext = chunk.extension || "";
  const sim = normalizeSimilarity(chunk.score) * w.similarity;

  if (hints.isDocQuery && DOC_EXTS.includes(ext)) return sim + w.docBoost;
  if (hints.isCodeQuery && CODE_EXTS.includes(ext)) return sim + w.codeBoost;

  return sim;
}

export function extMatchScore(chunk: RetrievedChunk, w: ScoringWeights): number {
  const ext = chunk.extension || "";
  if (DOC_EXTS.includes(ext)) return w.extMatch;
  if (CODE_EXTS.includes(ext)) return w.extMatch * 0.75;
  return 0;
}

export function keywordMatchScore(
  chunk: RetrievedChunk,
  w: ScoringWeights
): number {
  const rel = normalize(chunk.relativePath || "");
  if (!rel) return 0;

  return containsKeyword(rel, DOC_EXTS)
    ? w.keywordMatch * 1.1
    : containsKeyword(rel, CODE_EXTS)
    ? w.keywordMatch
    : 0;
}

export function filenameMatchScore(
  chunk: RetrievedChunk,
  w: ScoringWeights,
  hints: ReturnType<typeof deriveHints>
): number {
  const name = normalize(basename(chunk.relativePath || ""));
  if (!name) return 0;

  return hints.queryTokens.some((q) => name.includes(q))
    ? w.filenameMatch
    : 0;
}

export function pathMatchScore(
  chunk: RetrievedChunk,
  w: ScoringWeights,
  hints: ReturnType<typeof deriveHints>
): number {
  const treePathStr =
    Array.isArray(chunk.treePath)
      ? chunk.treePath.join("/")
      : (chunk.treePath || "");
  const tp = normalize(treePathStr);
  return hints.queryTokens.some((q) => q && tp.includes(q))
    ? w.pathMatch
    : 0;
}

export function sameFileScore(chunk: RetrievedChunk, w: ScoringWeights) {
  const name = basename(chunk.relativePath || chunk.filePath || "");
  if (!name) return 0;

  return chunk.neighbors?.some((n) => n.startsWith(name)) ? w.sameFile : 0;
}

export function neighborScore(chunk: RetrievedChunk, w: ScoringWeights) {
  return chunk.neighbors && chunk.neighbors.length ? w.neighbor : 0;
}

export function depthScore(chunk: RetrievedChunk, w: ScoringWeights) {
  return (chunk.depth || 0) * w.depth;
}

export function computeChunkScore(
  chunk: RetrievedChunk,
  w: ScoringWeights,
  hints: ReturnType<typeof deriveHints>
): number {
  return (
    similarityScore(chunk, w, hints) +
    extMatchScore(chunk, w) +
    keywordMatchScore(chunk, w) +
    filenameMatchScore(chunk, w, hints) +
    pathMatchScore(chunk, w, hints) +
    sameFileScore(chunk, w) +
    neighborScore(chunk, w) +
    depthScore(chunk, w) +
    tinyPathSpread(chunk.relativePath)
  );
}

export function scoreAll(
  retrievedChunks: RetrievedChunk[],
  query: string,
  weights: ScoringWeights
): ScoredChunk[] {
  const hints = deriveHints(query);
  return retrievedChunks.map((chunk) => ({
    ...chunk,
    _finalScore: computeChunkScore(chunk, weights, hints),
  }));
}
