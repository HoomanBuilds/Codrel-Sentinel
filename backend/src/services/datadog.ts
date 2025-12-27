import type { Decision } from './riskEngine.js';

const DD_API_KEY = process.env.DD_API_KEY || '';
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const DD_SERVICE = process.env.DD_SERVICE || 'codrel-sentinel';
const DD_ENV = process.env.DD_ENV || 'development';

let initialized = false;

interface LogEntry {
  message: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  ddsource: string;
  ddtags: string;
  [key: string]: unknown;
}

async function sendLog(entry: LogEntry): Promise<void> {
  if (!DD_API_KEY) {
    console.log(`[DD Log] ${entry.level.toUpperCase()}: ${entry.message}`);
    return;
  }

  try {
    await fetch(`https://http-intake.logs.${DD_SITE}/api/v2/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': DD_API_KEY,
      },
      body: JSON.stringify([entry]),
    });
  } catch (err) {
    console.error('[Datadog] Log send failed:', err);
  }
}

async function sendMetric(name: string, value: number, tags: string[]): Promise<void> {
  if (!DD_API_KEY) {
    console.log(`[DD Metric] ${name}=${value} [${tags.join(', ')}]`);
    return;
  }

  try {
    await fetch(`https://api.${DD_SITE}/api/v2/series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'DD-API-KEY': DD_API_KEY },
      body: JSON.stringify({
        series: [{
          metric: name,
          points: [{ timestamp: Math.floor(Date.now() / 1000), value }],
          type: 'count',
          tags: [`service:${DD_SERVICE}`, `env:${DD_ENV}`, ...tags],
        }],
      }),
    });
  } catch (err) {
    console.error('[Datadog] Metric failed:', err);
  }
}

export function initDatadog(): void {
  initialized = true;
  console.log(DD_API_KEY ? `[Datadog] Connected to ${DD_SITE}` : '[Datadog] Mock mode');
}

export async function logRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  latencyMs: number,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `${method} ${endpoint} - ${statusCode} (${latencyMs}ms)`,
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    service: DD_SERVICE,
    ddsource: 'nodejs',
    ddtags: `env:${DD_ENV},endpoint:${endpoint},method:${method},status:${statusCode}`,
    endpoint,
    method,
    statusCode,
    latencyMs,
    ...meta,
  });

  await sendMetric('sentinel.request.count', 1, [`endpoint:${endpoint}`, `status:${statusCode}`]);
  await sendMetric('sentinel.request.latency_ms', latencyMs, [`endpoint:${endpoint}`]);

  if (statusCode >= 500) {
    await sendMetric('sentinel.error.count', 1, [`endpoint:${endpoint}`]);
  }
}

export async function logInternalError(
  errorType: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `INTERNAL ERROR [${errorType}]: ${message}`,
    level: 'error',
    service: DD_SERVICE,
    ddsource: 'nodejs',
    ddtags: `env:${DD_ENV},error_type:${errorType},severity:critical`,
    errorType,
    context,
  });

  await sendMetric('sentinel.internal_error.count', 1, [`type:${errorType}`]);
}

export async function logTokenExhausted(provider: string, remaining: number): Promise<void> {
  await logInternalError('token_exhausted', `${provider} tokens exhausted`, { provider, remaining });
}

export async function logRateLimitHit(endpoint: string, limit: number): Promise<void> {
  await logInternalError('rate_limit', `Rate limit hit on ${endpoint}`, { endpoint, limit });
}

export async function logWebhookEvent(
  source: 'github' | 'ci' | 'other',
  eventType: string,
  repoId: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `Webhook [${source}] ${eventType} for ${repoId}`,
    level: 'info',
    service: DD_SERVICE,
    ddsource: 'webhook',
    ddtags: `env:${DD_ENV},source:${source},event:${eventType},repo:${repoId}`,
    source,
    eventType,
    repoId,
    ...data,
  });

  await sendMetric('sentinel.webhook.count', 1, [`source:${source}`, `event:${eventType}`]);
}

export async function logCIFailure(
  repoId: string,
  filePath: string,
  failureType: string,
  errorMessage?: string,
  buildUrl?: string
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `CI Failure in ${repoId}: ${filePath} - ${failureType}`,
    level: 'warn',
    service: DD_SERVICE,
    ddsource: 'ci',
    ddtags: `env:${DD_ENV},repo:${repoId},file:${filePath},failure_type:${failureType}`,
    repoId,
    filePath,
    failureType,
    errorMessage,
    buildUrl,
    timestamp: new Date().toISOString(),
  });

  await sendMetric('sentinel.ci_failure.count', 1, [`repo:${repoId}`, `type:${failureType}`]);
}

export async function logRiskAssessment(
  repoId: string,
  agent: string,
  decision: Decision,
  riskScore: number,
  reasons: string[],
  filesChecked: string[]
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `Risk Assessment: ${decision.toUpperCase()} (${riskScore}) for ${repoId}`,
    level: decision === 'block' ? 'warn' : 'info',
    service: DD_SERVICE,
    ddsource: 'risk-engine',
    ddtags: `env:${DD_ENV},repo:${repoId},agent:${agent},decision:${decision}`,
    repoId,
    agent,
    decision,
    riskScore,
    reasons,
    filesChecked,
    timestamp: new Date().toISOString(),
  });

  await sendMetric('sentinel.risk.score', riskScore, [`repo:${repoId}`, `agent:${agent}`]);
  await sendMetric('sentinel.decision.count', 1, [`decision:${decision}`, `agent:${agent}`]);
}

export async function logFileSignal(
  repoId: string,
  filePath: string,
  signalType: 'ci_failure' | 'pr_reverted' | 'hotfix' | 'security_patch',
  meta?: Record<string, unknown>
): Promise<void> {
  if (!initialized) return;

  await sendLog({
    message: `File Signal [${signalType}]: ${repoId}/${filePath}`,
    level: signalType === 'security_patch' ? 'warn' : 'info',
    service: DD_SERVICE,
    ddsource: 'file-signal',
    ddtags: `env:${DD_ENV},repo:${repoId},file:${filePath},signal:${signalType}`,
    repoId,
    filePath,
    signalType,
    ...meta,
    timestamp: new Date().toISOString(),
  });

  await sendMetric('sentinel.file_signal.count', 1, [`repo:${repoId}`, `signal:${signalType}`]);
}

export interface FileHistoryFromDD {
  filePath: string;
  ciFailures: number;
  revertedPrs: number;
  lastFailure?: string;
  failureReasons?: string[];
}

export async function queryFileHistory(repoId: string, filePath: string): Promise<FileHistoryFromDD | null> {
  console.log(`[DD Query] File history for ${repoId}/${filePath}`);
  return null;
}
