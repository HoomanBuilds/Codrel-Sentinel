import { GoogleGenAI } from "@google/genai";

export const genai = new GoogleGenAI({
  vertexai: true, 
  project: "ancient-episode-482912-n2",
  location: "us-central1",
});