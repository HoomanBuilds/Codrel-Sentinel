import { Request, Response } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { publishElevenLabsCall } from "../../services/kafkaProducer.js";
import { logRequest } from "../../services/datadog.js";
import { DatadogWebhookSchema, DatadogWebhookPayload } from "../types.js";
import { parseDatadogTags, logPrefix } from "../utils.js";

const LOG = logPrefix("Datadog");

export async function handleDatadogWebhook(req: Request, res: Response) {
  try {
    const payload = DatadogWebhookSchema.parse(req.body);
    console.log(`${LOG} Alert: ${payload.title} (${payload.alert_type})`);

    const context = extractContext(payload);
    await processAlert(payload, context);

    await logRequest("/webhooks/datadog", "POST", 200, 0, { alertType: payload.alert_type });
    res.json({ received: true, processed: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid payload", details: err.errors });
    }
    throw err;
  }
}

interface AlertContext {
  repoId?: string;
  agent?: string;
}

function extractContext(payload: DatadogWebhookPayload): AlertContext {
  const tags = parseDatadogTags(payload.tags || []);
  return { repoId: tags.repo, agent: tags.agent };
}

async function processAlert(payload: DatadogWebhookPayload, context: AlertContext): Promise<void> {
  if (isCriticalAlert(payload)) {
    await triggerVoiceAlert(payload, "high");
  }

  if (isAgentAbuseAlert(payload) && context.agent && context.repoId) {
    await handleAgentAbuse(context.agent, context.repoId);
  }

  if (isInternalIssue(payload)) {
    await triggerVoiceAlert(payload, "medium");
  }
}

function isCriticalAlert(payload: DatadogWebhookPayload): boolean {
  return payload.alert_type === "error" || payload.title.includes("Critical");
}

function isAgentAbuseAlert(payload: DatadogWebhookPayload): boolean {
  return payload.title.includes("Agent") && payload.title.includes("Repeated");
}

function isInternalIssue(payload: DatadogWebhookPayload): boolean {
  return payload.title.includes("Token") || payload.title.includes("Rate Limit");
}

async function triggerVoiceAlert(payload: DatadogWebhookPayload, priority: "high" | "medium" | "low"): Promise<void> {
  const message = priority === "high"
    ? `Codrel Alert: ${payload.title}. ${payload.body || ""}`
    : `Internal Issue: ${payload.title}`;

  await publishElevenLabsCall({ eventId: uuid(), message, priority });
  console.log(`${LOG} Triggered ElevenLabs call (${priority} priority)`);
}

async function handleAgentAbuse(agent: string, repoId: string): Promise<void> {
  console.log(`${LOG} Auto-flagging agent: ${agent} in ${repoId}`);
}
