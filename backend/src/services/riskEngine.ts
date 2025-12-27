import { getFileMetadata } from './db.js';

export type Decision = 'allow' | 'warn' | 'block';

export interface RiskAssessment {
  riskScore: number;
  decision: Decision;
  reasons: string[];
  evidenceIds?: string[];
}

interface RiskInput {
  repoId: string;
  agent: string;
  changedFiles: string[];
  diffSummary?: string;
}

const CRITICAL_PATHS = ['auth/', 'security/', 'payments/', 'infra/', 'secrets/'];
const SENSITIVE_FILES = ['.env', 'config.prod', 'credentials', 'private'];

function pathRisk(filePath: string): { score: number; reason?: string } {
  const normalized = filePath.toLowerCase();
  
  for (const critical of CRITICAL_PATHS) {
    if (normalized.includes(critical)) {
      return { score: 0.4, reason: `Critical path: ${critical}` };
    }
  }
  
  for (const sensitive of SENSITIVE_FILES) {
    if (normalized.includes(sensitive)) {
      return { score: 0.5, reason: `Sensitive file pattern: ${sensitive}` };
    }
  }
  
  return { score: 0 };
}

function computeHistoricalRisk(meta: { ciFailures: number; revertedPrs: number; changeFrequency: number }): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  if (meta.ciFailures > 3) {
    score += 0.2;
    reasons.push(`High CI failure count: ${meta.ciFailures}`);
  }
  
  if (meta.revertedPrs > 2) {
    score += 0.25;
    reasons.push(`Multiple reverted PRs: ${meta.revertedPrs}`);
  }
  
  if (meta.changeFrequency > 10) {
    score += 0.15;
    reasons.push(`High change frequency: ${meta.changeFrequency}/week`);
  }
  
  return { score, reasons };
}

function scoreToDecision(score: number): Decision {
  if (score >= 0.7) return 'block';
  if (score >= 0.3) return 'warn';
  return 'allow';
}

export async function assessRisk(input: RiskInput): Promise<RiskAssessment> {
  const reasons: string[] = [];
  let totalScore = 0;
  
  for (const file of input.changedFiles) {
    const pathResult = pathRisk(file);
    totalScore += pathResult.score;
    if (pathResult.reason) reasons.push(pathResult.reason);
    
    const meta = await getFileMetadata(input.repoId, file);
    if (meta) {
      const historical = computeHistoricalRisk(meta);
      totalScore += historical.score;
      reasons.push(...historical.reasons);
    }
  }
  
  const normalizedScore = Math.min(totalScore / Math.max(input.changedFiles.length, 1), 1.0);
  const decision = scoreToDecision(normalizedScore);
  
  if (reasons.length === 0) {
    reasons.push('No risk signals detected');
  }
  
  return {
    riskScore: Math.round(normalizedScore * 100) / 100,
    decision,
    reasons,
  };
}
