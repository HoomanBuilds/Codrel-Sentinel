import { Router } from 'express';
import { z } from 'zod';
import { assessRisk, type RiskAssessment } from '../services/riskEngine.js';
import { publishRiskEvent } from '../services/kafkaProducer.js';
import { logRequest, logRiskAssessment, logInternalError } from '../services/datadog.js';
import { saveRiskEvent } from '../services/db.js';
import { v4 as uuid } from 'uuid';

export const mcpRouter : Router = Router();

const AssessFileRiskSchema = z.object({
  repoId: z.string(),
  agent: z.string(),
  changedFiles: z.array(z.string()),
  diffSummary: z.string().optional(),
});

const AnalyzeFileSchema = z.object({
  repoId: z.string(),
  filePath: z.string(),
  context: z.string().optional(),
});

mcpRouter.post('/assessFileRisk', async (req, res) => {
  const startTime = Date.now();
  try {
    const input = AssessFileRiskSchema.parse(req.body);
    const assessment = await assessRisk(input);
    
    const eventId = uuid();
    await saveRiskEvent({
      id: eventId,
      repoId: input.repoId,
      agent: input.agent,
      decision: assessment.decision,
      riskScore: assessment.riskScore,
      reasons: assessment.reasons,
      changedFiles: input.changedFiles,
      createdAt: new Date(),
    });

    await publishRiskEvent({
      eventId,
      repoId: input.repoId,
      assessment,
      timestamp: Date.now(),
    });

    const latency = Date.now() - startTime;
    await logRequest('/mcp/assessFileRisk', 'POST', 200, latency, { repoId: input.repoId });
    await logRiskAssessment(
      input.repoId,
      input.agent,
      assessment.decision,
      assessment.riskScore,
      assessment.reasons,
      input.changedFiles
    );

    res.json(assessment);
  } catch (err) {
    if (err instanceof z.ZodError) {
      await logRequest('/mcp/assessFileRisk', 'POST', 400, Date.now() - startTime);
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    await logInternalError('assessment_failed', (err as Error).message);
    throw err;
  }
});

mcpRouter.post('/analyzeFile', async (req, res) => {
  const startTime = Date.now();
  try {
    const input = AnalyzeFileSchema.parse(req.body);
    
    const assessment = await assessRisk({
      repoId: input.repoId,
      agent: 'analyzer',
      changedFiles: [input.filePath],
    });

    const response: RiskAssessment & { ragContext?: string } = {
      ...assessment,
    };

    if (assessment.riskScore > 0.5) {
      response.ragContext = `[Mock RAG] Historical context for ${input.filePath}`;
      response.evidenceIds = [`rag-${uuid().slice(0, 8)}`];
    }

    const latency = Date.now() - startTime;
    await logRequest('/mcp/analyzeFile', 'POST', 200, latency, { repoId: input.repoId, filePath: input.filePath });

    res.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      await logRequest('/mcp/analyzeFile', 'POST', 400, Date.now() - startTime);
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});
