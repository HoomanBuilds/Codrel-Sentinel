
export enum TimeRange {
  TODAY = 'Today',
  WEEK = '7 Days',
  MONTH = '1 Month',
}


export interface AnalyticsMetadata {
  latency_ms?: number;
  total_latency_ms?: number;
  query_length?: number;
  k?: number;
  retrievals?: number;
  vector_avg_score?: number;
  totalTokens?: number;
  newChunkCount?: number;
  name?: string;
  description?: string;
  deleted?: boolean;
  [key: string]: any;
}
