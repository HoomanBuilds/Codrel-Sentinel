import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { publishElevenLabsCall } from '../services/kafkaProducer.js';
import { logRequest } from '../services/datadog.js';

export const voiceRouter: Router = Router();

const TriggerVoiceSchema = z.object({
  eventId: z.string().optional(),
  message: z.string().max(500),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  context: z.object({
    repoId: z.string().optional(),
    decision: z.string().optional(),
    riskScore: z.number().optional(),
  }).optional(),
});

const ExplainDecisionSchema = z.object({
  decision: z.enum(['allow', 'warn', 'block']),
  riskScore: z.number(),
  reasons: z.array(z.string()),
  repoId: z.string(),
  agent: z.string().optional(),
});

voiceRouter.post('/triggerVoice', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const input = TriggerVoiceSchema.parse(req.body);
    const eventId = input.eventId || uuid();

    await publishElevenLabsCall({
      eventId,
      message: input.message,
      priority: input.priority,
    });

    await logRequest(
      '/tts/triggerVoice',
      'POST',
      200,
      Date.now() - startTime,
      { priority: input.priority }
    );

    res.json({
      success: true,
      eventId,
      status: 'queued',
      estimatedDelay:
        input.priority === 'high'
          ? '< 5s'
          : input.priority === 'medium'
          ? '< 30s'
          : '< 2min',
    });
  } catch (err) {
    await logRequest('/tts/triggerVoice', 'POST', 400, Date.now() - startTime);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    next(err);
  }
});