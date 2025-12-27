import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { publishElevenLabsCall } from '../services/kafkaProducer.js';
import { logRequest } from '../services/datadog.js';

export const voiceRouter : Router= Router();

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

voiceRouter.post('/triggerVoice', async (req, res) => {
  const startTime = Date.now();
  try {
    const input = TriggerVoiceSchema.parse(req.body);
    const eventId = input.eventId || uuid();

    await publishElevenLabsCall({
      eventId,
      message: input.message,
      priority: input.priority,
      context: input.context,
    });

    await logRequest('/mcp/triggerVoice', 'POST', 200, Date.now() - startTime, { priority: input.priority });

    res.json({
      success: true,
      eventId,
      status: 'queued',
      estimatedDelay: input.priority === 'high' ? '< 5s' : input.priority === 'medium' ? '< 30s' : '< 2min',
    });
  } catch (err) {
    await logRequest('/mcp/triggerVoice', 'POST', 400, Date.now() - startTime);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

const ExplainDecisionSchema = z.object({
  decision: z.enum(['allow', 'warn', 'block']),
  riskScore: z.number(),
  reasons: z.array(z.string()),
  repoId: z.string(),
  agent: z.string().optional(),
});

voiceRouter.post('/explainDecision', async (req, res) => {
  try {
    const input = ExplainDecisionSchema.parse(req.body);
    
    const explanation = generateExplanation(input);
    const eventId = uuid();
    
    if (input.decision === 'block' || (input.decision === 'warn' && input.riskScore > 0.6)) {
      await publishElevenLabsCall({
        eventId,
        message: explanation,
        priority: input.decision === 'block' ? 'high' : 'medium',
        context: {
          repoId: input.repoId,
          decision: input.decision,
          riskScore: input.riskScore,
        },
      });
    }

    res.json({
      success: true,
      eventId,
      explanation,
      voiceTriggered: input.decision === 'block' || input.riskScore > 0.6,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

function generateExplanation(input: z.infer<typeof ExplainDecisionSchema>): string {
  const { decision, riskScore, reasons, repoId, agent } = input;
  
  if (decision === 'block') {
    return `Attention: A code change has been blocked in repository ${repoId}. ` +
      `Risk score: ${Math.round(riskScore * 100)} percent. ` +
      `Reasons: ${reasons.slice(0, 2).join('. ')}. ` +
      `Please review before proceeding.`;
  }
  
  if (decision === 'warn') {
    return `Warning: High risk change detected in ${repoId}. ` +
      `Risk score: ${Math.round(riskScore * 100)} percent. ` +
      `${reasons[0]}. Consider additional review.`;
  }
  
  return `Change approved for ${repoId}. Risk level: low.`;
}

voiceRouter.get('/voiceStatus/:eventId', async (req, res) => {
  res.json({
    eventId: req.params.eventId,
    status: 'completed', // queued | processing | completed | failed
    audioUrl: `https://api.elevenlabs.io/audio/mock-${req.params.eventId}.mp3`,
    durationMs: 3500,
  });
});
