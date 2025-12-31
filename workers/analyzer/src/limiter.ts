import Bottleneck from "bottleneck";

export const generationLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 300,
  expiration: 180_000,
});

export function withGeminiLimit<T>(fn: () => Promise<T>): Promise<T> {
  return generationLimiter.schedule(fn);
}
