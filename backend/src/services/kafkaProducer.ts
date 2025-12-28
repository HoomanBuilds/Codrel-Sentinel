import { Kafka, Producer, logLevel } from "kafkajs";
import type { RiskAssessment } from "./riskEngine.js";

const kafka = new Kafka({
  clientId: "codrel-sentinel",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  logLevel: logLevel.WARN,
});

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log("[Kafka] Producer connected to", process.env.KAFKA_BROKER || "localhost:9092");
  }
  return producer;
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log("[Kafka] Producer disconnected");
  }
}

interface RiskEventPayload {
  eventId: string;
  repoId: string;
  assessment: RiskAssessment;
  timestamp: number;
}

interface ElevenLabsPayload {
  eventId: string;
  message: string;
  priority: "low" | "medium" | "high";
  context?: Record<string, unknown>;
}

interface IndexJobPayload {
  jobId: string;
  repoId: string;
  type: "full" | "incremental";
  paths?: string[];
}

const TOPICS = {
  RISK_EVENTS: "codrel.risk.events",
  FILE_SIGNALS: "codrel.file.signals",
  RAG_REQUESTS: "codrel.rag.requests",
  ELEVENLAB_CALLS: "tts.elevenlabs.jobs",
  INDEX_JOBS: "codrel.index.jobs",
  REPO_EVENTS: "codrel.repo.events",
} as const;

async function produce(topic: string, payload: unknown): Promise<void> {
  try {
    const p = await getProducer();
    await p.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    console.log(`[Kafka] -> ${topic}:`, JSON.stringify(payload).slice(0, 100));
  } catch (err) {
    console.error(`[Kafka] Failed to produce to ${topic}:`, err);
  }
}

export async function publishRiskEvent(payload: RiskEventPayload): Promise<void> {
  await produce(TOPICS.RISK_EVENTS, payload);

  if (payload.assessment.decision === "block") {
    await publishElevenLabsCall({
      eventId: payload.eventId,
      message: `Blocked change in repo ${payload.repoId}: ${payload.assessment.reasons[0]}`,
      priority: "high",
      context: { repoId: payload.repoId, decision: "block", riskScore: payload.assessment.riskScore },
    });
  }
}

export async function publishFileSignal(repoId: string, filePath: string, signal: Record<string, unknown>): Promise<void> {
  await produce(TOPICS.FILE_SIGNALS, { repoId, filePath, signal, timestamp: Date.now() });
}

export async function publishRagRequest(repoId: string, query: string): Promise<void> {
  await produce(TOPICS.RAG_REQUESTS, { repoId, query, timestamp: Date.now() });
}

export async function publishElevenLabsCall(payload: ElevenLabsPayload): Promise<void> {
  await produce(TOPICS.ELEVENLAB_CALLS, payload);
}

export async function publishIndexJob(payload: IndexJobPayload): Promise<void> {
  await produce(TOPICS.INDEX_JOBS, { ...payload, timestamp: Date.now() });
}

export async function publishRepoEvent(repoId: string, event: string, data?: Record<string, unknown>): Promise<void> {
  await produce(TOPICS.REPO_EVENTS, { repoId, event, data, timestamp: Date.now() });
}
