import { genai } from "./client";

type GeminiErrorType =
  | "RATE_LIMIT"
  | "SAFETY_BLOCK"
  | "EMPTY_RESPONSE"
  | "INVALID_JSON"
  | "UNKNOWN";

export async function generateText(
  model: string,
  prompt: string,
  jsonSchema: any = null
): Promise<string> {
  const config: any = {};

  if (jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = jsonSchema;
  }

  let res: any;

  try {
    res = await genai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? err);

    if (msg.includes("429")) {
      throw Object.assign(new Error("Gemini rate limit"), {
        type: "RATE_LIMIT" as GeminiErrorType,
      });
    }

    throw Object.assign(new Error("Gemini request failed"), {
      type: "UNKNOWN" as GeminiErrorType,
      cause: err,
    });
  }

  const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw Object.assign(new Error("Empty Gemini response"), {
      type: "EMPTY_RESPONSE" as GeminiErrorType,
      raw: res,
    });
  }

  return text;
}
