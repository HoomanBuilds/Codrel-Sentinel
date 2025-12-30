import { genai } from "./client";
import { withGeminiLimit } from "../limiter";

export async function generateText(
  model: string,
  prompt: string
): Promise<string> {
  return withGeminiLimit(async () => {
    const stream = await genai.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    let out = "";
    for await (const chunk of stream) out += chunk.text;
    return out;
  });
}
