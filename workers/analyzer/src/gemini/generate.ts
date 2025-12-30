import { genai } from "./client";
import { withGeminiLimit } from "../limiter";

export async function generateText(
  model: string,
  prompt: string,
  jsonSchema: any = null
): Promise<string> {
  return withGeminiLimit(async () => {
    const config: any = {};
    if (jsonSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = jsonSchema;
    }

    const res = await genai.models.generateContent({
      model: model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("❌ Gemini Error: No text found in response:", JSON.stringify(res, null, 2));
      throw new Error("Gemini returned empty response");
    }

    return text;
  });
}