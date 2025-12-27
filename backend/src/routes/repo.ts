import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { 
  saveRepo, 
  getRepo, 
  saveFileMetadata, 
  getFileMetadata,
  getRepoFiles,
  saveIndexJob,
  getIndexJob,
  updateIndexJob,
} from '../services/db.js';
import { publishIndexJob, publishFileSignal } from '../services/kafkaProducer.js';
import { logRequest, logFileSignal, queryFileHistory } from '../services/datadog.js';

export const repoRouter : Router = Router();

const ConnectRepoSchema = z.object({
  repoUrl: z.string().url(),
  installationId: z.union([z.string(), z.number()]).optional(),
  defaultBranch: z.string().default('main'),
  webhookSecret: z.string().optional(),
});

repoRouter.post('/connectRepo', async (req, res) => {
  console.log('[connectRepo] Request body:', JSON.stringify(req.body));
  
  try {
    const input = ConnectRepoSchema.parse(req.body);
    
    const urlMatch = input.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
      console.log('[connectRepo] Invalid GitHub URL:', input.repoUrl);
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }
    
    const owner = urlMatch[1];
    const name = urlMatch[2].replace(/\.git$/, '');
    const repoId = `${owner}/${name}`;
    
    console.log('[connectRepo] Connecting repo:', repoId);
    
    const existingRepo = await getRepo(repoId);
    if (existingRepo) {
      console.log('[connectRepo] Repo already connected:', repoId);
      return res.status(409).json({ error: 'Repository already connected', repoId });
    }

    const repo = {
      id: repoId,
      name,
      owner,
      url: input.repoUrl,
      defaultBranch: input.defaultBranch,
      webhookSecret: input.webhookSecret || uuid(),
      installationId: input.installationId ? Number(input.installationId) : undefined,
      riskProfile: 'unknown' as const,
      status: 'pending' as const,
      connectedAt: new Date(),
      lastSyncedAt: null,
    };

    await saveRepo(repo);
    await logRequest('/mcp/connectRepo', 'POST', 201, 0, { repoId });

    const jobId = uuid();
    await saveIndexJob({
      id: jobId,
      repoId,
      status: 'queued',
      type: 'full',
      createdAt: new Date(),
    });
    await publishIndexJob({ jobId, repoId, type: 'full' });

    console.log('[connectRepo] Success:', repoId, 'jobId:', jobId);

    res.status(201).json({
      success: true,
      repoId,
      webhookSecret: repo.webhookSecret,
      indexJobId: jobId,
      message: 'Repository connected. Initial indexing queued.',
    });
  } catch (err) {
    console.error('[connectRepo] Error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

const TriggerIndexSchema = z.object({
  repoId: z.string(),
  type: z.enum(['full', 'incremental']).default('incremental'),
  paths: z.array(z.string()).optional(),
});

repoRouter.post('/triggerIndex', async (req, res) => {
  try {
    const input = TriggerIndexSchema.parse(req.body);
    
    const repo = await getRepo(input.repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const jobId = uuid();
    await saveIndexJob({
      id: jobId,
      repoId: input.repoId,
      status: 'queued',
      type: input.type,
      paths: input.paths,
      createdAt: new Date(),
    });

    await publishIndexJob({ 
      jobId, 
      repoId: input.repoId, 
      type: input.type,
      paths: input.paths,
    });
    await logRequest('/mcp/triggerIndex', 'POST', 200, 0, { repoId: input.repoId, type: input.type });

    res.json({
      success: true,
      jobId,
      status: 'queued',
      message: `${input.type} indexing job queued`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

repoRouter.get('/indexStatus/:jobId', async (req, res) => {
  const job = await getIndexJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

repoRouter.get('/repoStatus/:repoId', async (req, res) => {
  const repo = await getRepo(req.params.repoId);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  const files = await getRepoFiles(req.params.repoId);
  const riskyFiles = files.filter(f => f.ciFailures > 2 || f.revertedPrs > 1);
  
  res.json({
    repo,
    stats: {
      totalFiles: files.length,
      riskyFiles: riskyFiles.length,
      avgCiFailures: files.reduce((sum, f) => sum + f.ciFailures, 0) / Math.max(files.length, 1),
      avgRevertedPrs: files.reduce((sum, f) => sum + f.revertedPrs, 0) / Math.max(files.length, 1),
    },
    topRiskyFiles: riskyFiles.slice(0, 10).map(f => ({
      path: f.filePath,
      ciFailures: f.ciFailures,
      revertedPrs: f.revertedPrs,
    })),
  });
});

const IngestSignalSchema = z.object({
  repoId: z.string(),
  signalType: z.enum(['ci_failure', 'pr_reverted', 'hotfix', 'security_patch', 'deploy_rollback']),
  filePaths: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(),
});

repoRouter.post('/ingestSignal', async (req, res) => {
  try {
    const input = IngestSignalSchema.parse(req.body);
    
    const results = await Promise.all(
      input.filePaths.map(async (filePath) => {
        const existing = await getFileMetadata(input.repoId, filePath);
        const updated = {
          repoId: input.repoId,
          filePath,
          ciFailures: existing?.ciFailures || 0,
          revertedPrs: existing?.revertedPrs || 0,
          changeFrequency: (existing?.changeFrequency || 0) + 1,
          lastModified: new Date(),
        };

        if (input.signalType === 'ci_failure') updated.ciFailures++;
        if (input.signalType === 'pr_reverted') updated.revertedPrs++;

        await saveFileMetadata(updated);
        await publishFileSignal(input.repoId, filePath, {
          type: input.signalType,
          metadata: input.metadata,
          timestamp: input.timestamp || Date.now(),
        });

        await logFileSignal(input.repoId, filePath, input.signalType as any, input.metadata);

        return { filePath, updated: true };
      })
    );

    await logRequest('/mcp/ingestSignal', 'POST', 200, 0, { 
      repoId: input.repoId, 
      signalType: input.signalType,
      filesCount: input.filePaths.length 
    });

    res.json({
      success: true,
      signalType: input.signalType,
      filesUpdated: results.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    throw err;
  }
});

repoRouter.get('/fileHistory/:repoId/:filePath(*)', async (req, res) => {
  const repoId = req.params.repoId;
  const filePath = req.params.filePath;

  const meta = await getFileMetadata(repoId, filePath);
  
  const ddHistory = await queryFileHistory(repoId, filePath);
  
  const ciFailures = Math.max(meta?.ciFailures || 0, ddHistory?.ciFailures || 0);
  const revertedPrs = Math.max(meta?.revertedPrs || 0, ddHistory?.revertedPrs || 0);
  
  const riskLevel = ciFailures > 3 || revertedPrs > 2 ? 'high' :  ciFailures > 1 || revertedPrs > 0 ? 'medium' : 'low';

  await logRequest('/mcp/fileHistory', 'GET', 200, 0, { repoId, filePath, riskLevel });

  res.json({
    filePath,
    repoId,
    riskSignals: {
      ciFailures,
      revertedPrs,
      changeFrequency: meta?.changeFrequency || 0,
    },
    datadogContext: ddHistory ? {
      lastFailure: ddHistory.lastFailure,
      failureReasons: ddHistory.failureReasons,
    } : null,
    lastModified: meta?.lastModified,
    riskLevel,
    promptContext: riskLevel === 'high' 
      ? `⚠️ HIGH RISK FILE: This file has caused ${ciFailures} CI failures and ${revertedPrs} reverted PRs. Proceed with extra caution.`
      : riskLevel === 'medium'
      ? `⚡ MEDIUM RISK: This file has some history of issues. Review changes carefully.`
      : `✅ LOW RISK: No significant failure history for this file.`,
  });
});

repoRouter.post('/disconnectRepo', async (req, res) => {
  const { repoId } = req.body;
  if (!repoId) {
    return res.status(400).json({ error: 'repoId required' });
  }
  
  await logRequest('/mcp/disconnectRepo', 'POST', 200, 0, { repoId });
  res.json({ success: true, message: 'Repository disconnected' });
});
