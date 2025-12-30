import { getRepoInstallationToken } from "@/lib/github";
import { Kafka } from "kafkajs";
export const runtime = "nodejs";

const kafka = new Kafka({
  clientId: "sentinel-webhook",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
let producerReady = false;

async function ensureProducer() {
  if (!producerReady) {
    await producer.connect();
    producerReady = true;
  }
}

async function hmacSHA256Hex(body: ArrayBuffer, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return new Response("Secret missing", { status: 500 });
    }

    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return new Response("No signature", { status: 401 });
    }

    const body = await req.arrayBuffer();
    const digest = `sha256=${await hmacSHA256Hex(body, secret)}`;

    if (!timingSafeEqual(digest, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let payload: any;
    const textDecoder = new TextDecoder();

    if (contentType.includes("application/json")) {
      payload = JSON.parse(textDecoder.decode(body));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(textDecoder.decode(body));
      payload = JSON.parse(params.get("payload") || "{}");
    } else {
      return new Response("Unsupported content type", { status: 415 });
    }

    const event = req.headers.get("x-github-event") || "unknown";

    if (event === "ping") {
      return Response.json({ ok: true });
    }
    if (
      event === "pull_request" &&
      (payload.action === "opened" || payload.action === "synchronize" || payload.action === "reopened")
    ) {
      console.log(`
          event : ${event}
          action : ${payload.action}
          repo-name : ${payload.repository.name}
          owner : ${payload.repository.owner.login}
          number : ${payload.number}
        `);
      try {
        await ensureProducer();

        const installationId = payload.installation?.id;
        if (!installationId) {
            console.error("No installation ID found in webhook payload");
            return new Response("Missing installation ID", { status: 400 });
        }
        const accessToken = await getRepoInstallationToken(Number(installationId));
        const kafkaPayload = {
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          pr_number: payload.number,
          access_token: accessToken, 
        };

        await producer.send({
          topic: "sentinelbot.events",
          messages: [
            {
              value: JSON.stringify(kafkaPayload),
            },
          ],
        });

        console.log(`[Sentinel] Queued PR analysis for ${kafkaPayload.repo}#${kafkaPayload.pr_number}`);
      } catch (kafkaErr) {
        console.error("Kafka Producer Error:", kafkaErr);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Webhook handler error", { status: 500 });
  }
}
