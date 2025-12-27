import crypto from "crypto";

export function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function parseDatadogTags(tags: string[]): Record<string, string | undefined> {
  const parsed: Record<string, string | undefined> = {};
  for (const tag of tags) {
    const [key, value] = tag.split(":");
    if (key && value) parsed[key] = value;
  }
  return parsed;
}

export function logPrefix(source: string): string {
  return `[Webhook:${source}]`;
}
