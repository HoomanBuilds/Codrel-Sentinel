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

export async function POST(req: Request) {
  const customSecret = req.headers.get("x-secret");
  
  const rawBody = Buffer.from(await req.arrayBuffer());
  if(customSecret !== process.env.DATADOG_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString());

  const message =
    req.headers.get("Message")??
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
    topic: "codrel.index.jobs",
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
      },
    ],
  });

  return NextResponse.json({ ok: true });
}
