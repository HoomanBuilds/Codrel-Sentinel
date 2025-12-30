export type RiskTier =
  | "ignorable"
  | "normal"
  | "need_context"
  | "deep_context"
  | "advanced_context_retrieval";

export type FileRiskEvent = {
  repo: string;
  file_path: string;
  affected_files?: string[];
  event_type: "workflow_crash" | "reverted_pr" | "rejected_pr" | "architecture";
  event_source_id?: string;
  severity_score: number;
  severity_label?: "low" | "medium" | "high" | "critical";
  risk_category?: string;
  keywords?: string[];
  summary?: string;
  raw_payload: any;
  created_at: string;
};

export type FileRiskResult = {
  file_path: string;
  final_risk_score: number;
  tier: RiskTier;

  components: {
    recency_weighted_risk: number;
    frequency_score: number;
    severity_entropy: number;
    correlation_score: number;
    instability_score: number;
  };

  signals: {
    dominant_event_type?: string;
    dominant_risk_category?: string;
    top_keywords: string[];
  };
};

const WEIGHTS = {
  recency: 0.35,
  frequency: 0.2,
  entropy: 0.15,
  correlation: 0.15,
  instability: 0.15,
};

const EVENT_TYPE_WEIGHT: Record<FileRiskEvent["event_type"], number> = {
  workflow_crash: 1.0,
  reverted_pr: 0.75,
  rejected_pr: 0.4,
  architecture: 0.2,
};

const HALF_LIFE_DAYS = 30;

export function analyzeFileRisk(
  filePath: string,
  events: FileRiskEvent[],
  now = Date.now()
): FileRiskResult {
  if (!events.length) {
    return {
      file_path: filePath,
      final_risk_score: 0,
      tier: "ignorable",
      components: zeroComponents(),
      signals: { top_keywords: [] },
    };
  }

  const recencyRisk = computeRecencyWeightedRisk(events, now);
  const frequencyScore = clamp(events.length / 20, 0, 1);
  const entropy = computeSeverityEntropy(events);
  const correlation = computeCorrelation(events);
  const instability = computeInstability(events);

  const finalScore =
    WEIGHTS.recency * recencyRisk +
    WEIGHTS.frequency * frequencyScore +
    WEIGHTS.entropy * entropy +
    WEIGHTS.correlation * correlation +
    WEIGHTS.instability * instability;

  return {
    file_path: filePath,
    final_risk_score: round(finalScore),
    tier: mapTier(finalScore),
    components: {
      recency_weighted_risk: round(recencyRisk),
      frequency_score: round(frequencyScore),
      severity_entropy: round(entropy),
      correlation_score: round(correlation),
      instability_score: round(instability),
    },
    signals: extractSignals(events),
  };
}

function computeRecencyWeightedRisk(
  events: FileRiskEvent[],
  now: number
): number {
  let sum = 0;
  let norm = 0;

  for (const e of events) {
    if (!e.created_at) {
      throw new Error("FileRiskEvent missing created_at");
    }

    const ageDays = (now - new Date(e.created_at).getTime()) / 86_400_000;

    const decay = Math.exp((-Math.log(2) * ageDays) / HALF_LIFE_DAYS);
    const weight = EVENT_TYPE_WEIGHT[e.event_type];

    sum += e.severity_score * weight * decay;
    norm += weight * decay;
  }

  return norm === 0 ? 0 : clamp(sum / norm, 0, 1);
}

function computeSeverityEntropy(events: FileRiskEvent[]): number {
  const buckets = [0, 0, 0, 0];
  for (const e of events) {
    if (e.severity_score >= 0.8) buckets[3]++;
    else if (e.severity_score >= 0.6) buckets[2]++;
    else if (e.severity_score >= 0.3) buckets[1]++;
    else buckets[0]++;
  }

  const total = events.length;
  let entropy = 0;

  for (const b of buckets) {
    if (!b) continue;
    const p = b / total;
    entropy -= p * Math.log2(p);
  }

  return clamp(entropy / 2, 0, 1);
}

function computeCorrelation(events: FileRiskEvent[]): number {
  let correlated = 0;
  for (const e of events) {
    if (e.affected_files && e.affected_files.length > 1) correlated++;
  }
  return clamp(correlated / events.length, 0, 1);
}

function computeInstability(events: FileRiskEvent[]): number {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime()
  );

  let deltaSum = 0;
  for (let i = 1; i < sorted.length; i++) {
    deltaSum += Math.abs(
      sorted[i].severity_score - sorted[i - 1].severity_score
    );
  }

  return clamp(deltaSum / Math.max(1, sorted.length - 1), 0, 1);
}

function mapTier(score: number): RiskTier {
  if (score < 0.15) return "ignorable";
  if (score < 0.3) return "normal";
  if (score < 0.5) return "need_context";
  if (score < 0.7) return "deep_context";
  return "advanced_context_retrieval";
}

function extractSignals(events: FileRiskEvent[]) {
  const typeCount: Record<string, number> = {};
  const riskCount: Record<string, number> = {};
  const keywordCount: Record<string, number> = {};

  for (const e of events) {
    typeCount[e.event_type] = (typeCount[e.event_type] ?? 0) + 1;
    if (e.risk_category)
      riskCount[e.risk_category] = (riskCount[e.risk_category] ?? 0) + 1;

    e.keywords?.forEach((k) => {
      keywordCount[k] = (keywordCount[k] ?? 0) + 1;
    });
  }

  return {
    dominant_event_type: maxKey(typeCount),
    dominant_risk_category: maxKey(riskCount),
    top_keywords: Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k),
  };
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const round = (v: number) => Math.round(v * 1000) / 1000;

const maxKey = (obj: Record<string, number>) =>
  Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0];

const zeroComponents = () => ({
  recency_weighted_risk: 0,
  frequency_score: 0,
  severity_entropy: 0,
  correlation_score: 0,
  instability_score: 0,
});

