import Bottleneck from "bottleneck";

function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`${time} [${tag}] ${msg}`);
}

export const generationLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 300,
  expiration: 180_000,
});

generationLimiter.on("idle", () => {
  log("Limiter", "🟢 idle");
});

generationLimiter.on("failed", (err, jobInfo) => {
  log(
    "Limiter",
    `❌ job failed id=${jobInfo.options.id ?? "n/a"} err=${err.message}`
  );
});

export function withGeminiLimit<T>(fn: () => Promise<T>): Promise<T> {
  return generationLimiter.schedule(async () => {
    log("Limiter", "⚡ start");
    try {
      return await fn();
    } finally {
      log("Limiter", "🧹 release");
    }
  });
}
