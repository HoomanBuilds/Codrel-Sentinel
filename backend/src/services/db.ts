import { RiskEvent } from '../models/riskEvent.js';
import { FileMeta } from '../models/fileMeta.js';
import { Repo, IndexJob, AgentActivity } from '../models/repo.js';

const repos: Map<string, Repo> = new Map();
const riskEvents: Map<string, RiskEvent> = new Map();
const fileMetadata: Map<string, FileMeta> = new Map();
const indexJobs: Map<string, IndexJob> = new Map();
const agentActivities: Map<string, AgentActivity> = new Map();

fileMetadata.set('repo-1:src/auth/login.ts', {
  repoId: 'repo-1',
  filePath: 'src/auth/login.ts',
  ciFailures: 5,
  revertedPrs: 3,
  changeFrequency: 12,
  lastModified: new Date(),
});

fileMetadata.set('repo-1:src/payments/stripe.ts', {
  repoId: 'repo-1',
  filePath: 'src/payments/stripe.ts',
  ciFailures: 2,
  revertedPrs: 4,
  changeFrequency: 8,
  lastModified: new Date(),
});

repos.set('repo-1', {
  id: 'repo-1',
  name: 'demo-app',
  owner: 'acme',
  url: 'https://github.com/acme/demo-app',
  defaultBranch: 'main',
  webhookSecret: 'secret-123',
  riskProfile: 'medium',
  status: 'active',
  connectedAt: new Date(),
  lastSyncedAt: new Date(),
});

export async function saveRepo(repo: Repo): Promise<void> {
  repos.set(repo.id, repo);
  console.log(`[DB] Saved repo: ${repo.id}`);
}

export async function getRepo(id: string): Promise<Repo | null> {
  return repos.get(id) || null;
}

export async function getAllRepos(): Promise<Repo[]> {
  return Array.from(repos.values());
}

export async function getFileMetadata(repoId: string, filePath: string): Promise<FileMeta | null> {
  const key = `${repoId}:${filePath}`;
  return fileMetadata.get(key) || null;
}

export async function saveFileMetadata(meta: FileMeta): Promise<void> {
  const key = `${meta.repoId}:${meta.filePath}`;
  fileMetadata.set(key, meta);
}

export async function getRepoFiles(repoId: string): Promise<FileMeta[]> {
  return Array.from(fileMetadata.values()).filter(f => f.repoId === repoId);
}

export async function saveRiskEvent(event: RiskEvent): Promise<void> {
  riskEvents.set(event.id, event);
  console.log(`[DB] Saved risk event: ${event.id} [${event.decision}]`);
}

export async function getRiskEvent(id: string): Promise<RiskEvent | null> {
  return riskEvents.get(id) || null;
}

export async function getRecentRiskEvents(repoId: string, limit = 10): Promise<RiskEvent[]> {
  return Array.from(riskEvents.values())
    .filter(e => e.repoId === repoId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function getRiskEventsByAgent(agent: string, limit = 50): Promise<RiskEvent[]> {
  return Array.from(riskEvents.values())
    .filter(e => e.agent === agent)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function saveIndexJob(job: IndexJob): Promise<void> {
  indexJobs.set(job.id, job);
  console.log(`[DB] Saved index job: ${job.id} [${job.status}]`);
}

export async function getIndexJob(id: string): Promise<IndexJob | null> {
  return indexJobs.get(id) || null;
}

export async function updateIndexJob(id: string, updates: Partial<IndexJob>): Promise<void> {
  const job = indexJobs.get(id);
  if (job) {
    indexJobs.set(id, { ...job, ...updates });
  }
}

export async function saveAgentActivity(activity: AgentActivity): Promise<void> {
  agentActivities.set(activity.id, activity);
  console.log(`[DB] Agent activity: ${activity.agent} - ${activity.action}`);
}

export async function getAgentStats(agent: string): Promise<{
  total: number;
  allowed: number;
  warned: number;
  blocked: number;
  recentEvents: RiskEvent[];
}> {
  const events = await getRiskEventsByAgent(agent);
  return {
    total: events.length,
    allowed: events.filter(e => e.decision === 'allow').length,
    warned: events.filter(e => e.decision === 'warn').length,
    blocked: events.filter(e => e.decision === 'block').length,
    recentEvents: events.slice(0, 5),
  };
}

export async function isAgentBlocked(agent: string, repoId?: string): Promise<boolean> {
  const activities = Array.from(agentActivities.values())
    .filter(a => a.agent === agent && a.action === 'blocked');
  
  return activities.some(a => a.repoId === 'global' || a.repoId === repoId);
}
