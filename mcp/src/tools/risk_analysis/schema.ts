import z from "zod";

export const RiskBaseInput = {
  repo: z.string().describe("repoistory name format : owner/repo , get it somehow with internal tooling or instructions"),
  files: z.array(z.string()).min(1).describe("critical (main) files for which you need historical context"),
  change: z.string().describe("RAG friendly explaination about change you did"),
};

export const RiskScoreSchema = z.object({
  ...RiskBaseInput,
});

export const RiskFullSchema = z.object({
  ...RiskBaseInput,
});
