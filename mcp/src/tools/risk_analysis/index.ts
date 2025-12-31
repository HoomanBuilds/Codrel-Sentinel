import z from "zod";
import { callRiskAPI } from "./client.js";
import { RiskScoreSchema, RiskFullSchema } from "./schema.js";

export const getRiskTools = (token: string) => ({
  risk_analysis_score: {
    tool: {
      title: "Risk Analysis Score",
      description: "Compute per-file risk score without context building.",
      inputSchema: RiskScoreSchema,
    },
    handler: async (input: z.infer<typeof RiskScoreSchema>) => {
      const data = await callRiskAPI(token, "score", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  },

  risk_analysis: {
    tool: {
      title: "Risk Analysis (Full)",
      description: "Compute risk + build contextual prompt per file.",
      inputSchema: RiskFullSchema,
    },
    handler: async (input: z.infer<typeof RiskFullSchema>) => {
      const data = await callRiskAPI(token, "full", input);
      return {
        content: [{ type: "text", text: data.context }],
      };
    },
  },
});
