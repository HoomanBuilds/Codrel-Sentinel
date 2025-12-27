export interface Repo {
  id: string;
  name: string;
  owner: string;
  url: string;
  defaultBranch: string;
  webhookSecret?: string;
  riskProfile: 'low' | 'medium' | 'high' | 'unknown';
  status: 'pending' | 'active' | 'indexing' | 'error';
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

export interface RepoStats {
  repoId: string;
  totalFiles: number;
  blockedChanges: number;
  warnedChanges: number;
  allowedChanges: number;
  lastAssessmentAt: Date;
}

export interface IndexJob {
  id: string;
  repoId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  type: 'full' | 'incremental';
  paths?: string[];
  progress?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentActivity {
  id: string;
  agent: string;
  repoId: string;
  action: 'assessment' | 'flagged' | 'blocked' | 'unblocked';
  reason?: string;
  duration?: '1h' | '24h' | '7d' | 'permanent';
  timestamp: Date;
}
