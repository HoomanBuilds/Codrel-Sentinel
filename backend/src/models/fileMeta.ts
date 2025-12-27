export interface FileMeta {
  repoId: string;
  filePath: string;
  ciFailures: number;
  revertedPrs: number;
  changeFrequency: number;
  lastModified: Date;
}

export interface FileSignal {
  type: 'ci_failure' | 'pr_reverted' | 'hotfix' | 'security_patch';
  filePath: string;
  repoId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
