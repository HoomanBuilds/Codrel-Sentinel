import type { ScoringWeights } from "../types.js";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  similarity: 1.0,
  docBoost: 0.55,
  codeBoost: 0.28,
  extMatch: 0.32,
  keywordMatch: 0.18,
  filenameMatch: 0.20,
  pathMatch: 0.12,
  sameFile: 0.06,
  neighbor: 0.04,
  depth: 0.009,
};
