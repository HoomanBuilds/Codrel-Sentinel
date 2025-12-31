import { NextResponse } from "next/server";
import { Kafka } from "kafkajs";
import crypto from "crypto";

export const runtime = "nodejs";

const kafka = new Kafka({
  clientId: "sentinel-datadog-webhook",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
let connected = false;

async function ensureProducer() {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
}

function verifyDatadogSignature(
  rawBody: Buffer,
  signature: string | null
) {
  if (!signature) return false;

  const secret = process.env.DATADOG_WEBHOOK_SECRET!;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-datadog-signature");

  if (!verifyDatadogSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: "Invalid Datadog signature" },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody.toString());

  const message =
    payload?.title ??
    payload?.body ??
    payload?.alert_title ??
    "Datadog alert triggered";

  const event = {
    eventId: `dd-${Date.now()}`,
    message,
    priority: payload?.priority ?? "high",
  };

  await ensureProducer();

  await producer.send({
    topic: process.env.KAFKA_TOPIC!,
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
      },
    ],
  });

  return NextResponse.json({ ok: true });
}
