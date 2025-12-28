export interface RagRequest {
  token: string;
  query: string;
  k: number;
  projectId: string;
  cloud?: boolean;
}

export interface RagMetadata {
  id: string;
  email?: string;
  source?: string;
  sourceType?: string;
  language?: string;
  extension?: string;

  relativePath?: string;
  treePath?: string | string[];

  startLine?: number;
  endLine?: number;

  tokenLength?: number;
  docId?: string;
}

export interface RagResult {
  vectorScore: number;
  id: string;
  metadata: RagMetadata;
  pageContent: string;
}

export interface RagApiResponse {
  success: boolean;
  retrievals: number;
  results: RagResult[];
}


export interface RetrievedChunk {
  pageContent: string | undefined;
  id: string;
  score: number;

  filePath: string;
  relativePath: string;
  extension: string;

  language?: string;

  treePath?: string[];
  tokenLength?: number;

  depth?: number;
  neighbors?: string[];

  docId?: string;
  email?: string;
}


export interface FullChunk {
  id: string;

  metadata?: RagMetadata;
  filePath: string;
  relativePath: string;
  extension: string;
  language: string;

  startLine: number;
  endLine: number;

  treePath: string[];
  text: string;

  tokenLength: number;

  source: string;
  sourceType: string;

  docId?: string;
  email?: string;

  pageContent?: string; 

  _finalScore?: number;
}

export interface ScoringWeights {
  similarity: number;
  docBoost: number;
  codeBoost: number;
  extMatch: number;
  keywordMatch: number;
  filenameMatch: number;
  pathMatch: number;
  sameFile: number;
  neighbor: number;
  depth: number;
}


export interface ScoredChunk extends RetrievedChunk {
  _finalScore: number;
}


export interface PreprocessOptions {
  retrievedChunks: RetrievedChunk[];
  fullChunks: Map<string, FullChunk>;
  query: string;
  weights?: ScoringWeights;
  tokenMax?: number | null;
  topK?: number | null;
}
