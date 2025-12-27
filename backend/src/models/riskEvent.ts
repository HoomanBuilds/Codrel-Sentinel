import type { Decision } from '../services/riskEngine.js';

export interface RiskEvent {
  id: string;
  repoId: string;
  agent: string;
  decision: Decision;
  riskScore: number;
  reasons: string[];
  changedFiles: string[];
  evidenceIds?: string[];
  createdAt: Date;
}

export interface RiskEventFilter {
  repoId?: string;
  decision?: Decision;
  minScore?: number;
  maxScore?: number;
  from?: Date;
  to?: Date;
}
