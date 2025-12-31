import type { ScoringWeights } from "../types.js";

export const BALANCED_WEIGHTS: ScoringWeights = {
  similarity:     1.0,
  docBoost:       0.10,
  codeBoost:      0.05,
  extMatch:       0.02,
  keywordMatch:   0.03,
  filenameMatch:  0.01, 
  pathMatch:      0.01,
  sameFile:       0.01,
  neighbor:       0.01,
  depth:          0.001,
};
