import { DOC_KEYWORDS, CODE_KEYWORDS } from "../utils/keywords.js";

export function basename(p: string | undefined): string {
  if (!p) return "";
  const parts = p.split(/[/\\]/);
  return parts.pop() || "";
}

export function normalize(s: string | undefined): string {
  return (s || "").toLowerCase();
}

export function containsKeyword(text: string, list: string[]): boolean {
  const t = normalize(text);
  return list.some((k) => t.includes(k));
}

export function deriveHints(query: string) {
  const q = normalize(query);

  const isDocQuery = containsKeyword(q, DOC_KEYWORDS);
  const isCodeQuery = containsKeyword(q, CODE_KEYWORDS);

  const tokens = q
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);

  return { isDocQuery, isCodeQuery, queryTokens: tokens };
}

export function normalizeSimilarity(score: number): number {
  if (typeof score !== "number") return 0;
  if (score > 1) return 1;
  if (score < 0) return 0;
  return score;
}

export function tinyPathSpread(relativePath?: string): number {
  const p = relativePath || "";
  if (!p) return 0;
  const depth = p.split(/[/\\]/g).length;
  return depth * 0.002;
}
