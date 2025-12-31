import { NextResponse } from "next/server";
import { Kafka } from "kafkajs";

export const runtime = "nodejs";

const kafka = new Kafka({
  clientId: "sentinel-webhook",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
let connected = false;
const BLOCKED = true;

async function ensureProducer() {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
}


export async function POST(req: Request) {
  if (BLOCKED) {
    return NextResponse.json(
      { ok: false, error: "Call alerts are currently blocked." },
      { status: 503 }
    );
  }

  const body = await req.json();

  if (!body.message) {
    return NextResponse.json(
      { ok: false, error: "message is required" },
      { status: 400 }
    );
  }

  const event = {
    eventId: body.eventId ?? `evt-${Date.now()}`,
    message: body.message,
    priority: body.priority ?? "normal",
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

  return NextResponse.json({ ok: true, event });
}
