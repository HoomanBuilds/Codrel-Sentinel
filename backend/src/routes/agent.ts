import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getAgentStats, saveAgentActivity } from '../services/db.js';
import { logRequest } from '../services/datadog.js';

export const agentRouter : Router = Router();

agentRouter.get('/agentStats/:agent', async (req, res) => {
  const agent = req.params.agent;
  const stats = await getAgentStats(agent);
  
  await logRequest('/mcp/agentStats', 'GET', 200, 0, { agent });
  
  res.json({
    agent,
    stats: {
      totalAssessments: stats.total,
      allowed: stats.allowed,
      warned: stats.warned,
      blocked: stats.blocked,
      riskRate: stats.total > 0 ? (stats.warned + stats.blocked) / stats.total : 0,
    },
    recentActivity: stats.recentEvents,
    riskLevel: stats.blocked > 5 ? 'dangerous' : stats.warned > 10 ? 'suspicious' : 'normal',
  });
});

agentRouter.get('/agentList', async (_req, res) => {
  const agents = [
    { name: 'cursor', status: 'active', riskLevel: 'low' },
    { name: 'copilot', status: 'active', riskLevel: 'low' },
    { name: 'codewhisperer', status: 'active', riskLevel: 'low' },
  ];
  res.json({ agents });
});

const ReportAgentSchema = z.object({
  agent: z.string(),
  repoId: z.string(),
  reason: z.string(),
  blockedCount: z.number(),
  warnCount: z.number(),
});

agentRouter.post('/reportAgentBehavior', async (req, res) => {
  try {
    const input = ReportAgentSchema.parse(req.body);
    
    await saveAgentActivity({
      id: uuid(),
      agent: input.agent,
      repoId: input.repoId,
      action: 'flagged',
      reason: input.reason,
      timestamp: new Date(),
    });

    await logRequest('/mcp/reportAgentBehavior', 'POST', 200, 0, { 
      agent: input.agent, 
      blockedCount: input.blockedCount 
    });

    res.json({
      success: true,
      message: 'Agent behavior reported',
      recommendation: input.blockedCount > 5 ? 'block_agent' : 'monitor',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

const BlockAgentSchema = z.object({
  agent: z.string(),
  repoId: z.string().optional(),
  reason: z.string(),
  duration: z.enum(['1h', '24h', '7d', 'permanent']).default('24h'),
});

agentRouter.post('/blockAgent', async (req, res) => {
  try {
    const input = BlockAgentSchema.parse(req.body);
    
    await saveAgentActivity({
      id: uuid(),
      agent: input.agent,
      repoId: input.repoId || 'global',
      action: 'blocked',
      reason: input.reason,
      duration: input.duration,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Agent ${input.agent} blocked for ${input.duration}`,
      scope: input.repoId || 'global',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});
