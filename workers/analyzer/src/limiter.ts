import Bottleneck from "bottleneck";

export const geminiLimiter = new Bottleneck({
  minTime: 3000,
  reservoir: 200,
  reservoirRefreshAmount: 200,
  reservoirRefreshInterval: 24 * 60 * 60 * 1000,
});

export async function withGeminiLimit<T>(fn: () => Promise<T>): Promise<T> {
  return geminiLimiter.schedule(fn);
}