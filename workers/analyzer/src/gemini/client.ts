import { GoogleGenAI } from "@google/genai";

export const genai = new GoogleGenAI({
  vertexai: true,  // <--- REQUIRED for Vertex AI
  project: "ancient-episode-482912-n2",
  location: "us-central1",
});