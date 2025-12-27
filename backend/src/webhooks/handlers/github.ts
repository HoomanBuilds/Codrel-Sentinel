import { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { getRepo } from "../../services/db.js";
import { publishFileSignal, publishIndexJob } from "../../services/kafkaProducer.js";
import { logWebhookEvent, logCIFailure, logRequest, logFileSignal } from "../../services/datadog.js";
import { assessRisk } from "../../services/riskEngine.js";
import {
  GitHubWebhookHeaders,
  GitHubPushPayload,
  GitHubPullRequestPayload,
  GitHubCheckRunPayload,
  GitHubWorkflowRunPayload,
  GitHubInstallationPayload,
} from "../types.js";
import { verifyGitHubSignature, logPrefix } from "../utils.js";

const LOG = logPrefix("GitHub");

export async function handleGitHubWebhook(req: Request, res: Response) {
  const headers = extractHeaders(req);
  const payload = req.body;
  const repoFullName = payload.repository?.full_name;

  console.log(`${LOG} Event: ${headers.event}, Delivery: ${headers.deliveryId}`);

  const isValid = await verifySignature(req, repoFullName);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    await routeEvent(headers.event, payload);

    await logWebhookEvent("github", headers.event, repoFullName || "unknown", {
      deliveryId: headers.deliveryId,
    });
    await logRequest("/webhooks/github", "POST", 200, 0, {
      event: headers.event,
      repoFullName,
    });

    res.json({
      received: true,
      event: headers.event,
      deliveryId: headers.deliveryId,
    });
  } catch (err) {
    console.error(`${LOG} Error:`, err);
    await logRequest("/webhooks/github", "POST", 500, 0, {
      error: (err as Error).message,
    });
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

function extractHeaders(req: Request): GitHubWebhookHeaders {
  return {
    event: req.headers["x-github-event"] as string,
    signature: req.headers["x-hub-signature-256"] as string | undefined,
    deliveryId: req.headers["x-github-delivery"] as string,
  };
}

async function verifySignature(req: Request, repoFullName?: string): Promise<boolean> {
  if (!repoFullName) return true;

  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) return true;

  const repo = await getRepo(repoFullName);
  if (!repo?.webhookSecret) return true;

  const payload = JSON.stringify(req.body);
  return verifyGitHubSignature(payload, signature, repo.webhookSecret);
}

async function routeEvent(event: string, payload: any): Promise<void> {
  switch (event) {
    case "push":
      await handlePush(payload);
      break;
    case "pull_request":
      await handlePullRequest(payload);
      break;
    case "check_run":
      await handleCheckRun(payload);
      break;
    case "workflow_run":
      await handleWorkflowRun(payload);
      break;
    case "installation":
    case "installation_repositories":
      await handleInstallation(payload);
      break;
    default:
      console.log(`${LOG} Unhandled event: ${event}`);
  }
}

async function handlePush(payload: GitHubPushPayload): Promise<void> {
  const repoId = payload.repository.full_name;
  const commits = payload.commits || [];

  const changedFiles = new Set<string>();
  for (const commit of commits) {
    commit.added?.forEach((f) => changedFiles.add(f));
    commit.modified?.forEach((f) => changedFiles.add(f));
  }

  if (changedFiles.size > 0) {
    await publishIndexJob({
      jobId: uuid(),
      repoId,
      type: "incremental",
      paths: Array.from(changedFiles),
    });
  }

  console.log(`${LOG} Push: ${repoId} - ${changedFiles.size} files changed`);
}

async function handlePullRequest(payload: GitHubPullRequestPayload): Promise<void> {
  const { action, pull_request: pr, repository } = payload;
  const repoId = repository.full_name;

  if (action === "opened" || action === "synchronize") {
    const changedFiles = pr.changed_files_list || [];

    if (changedFiles.length > 0) {
      const assessment = await assessRisk({
        repoId,
        agent: `github-pr-${pr.user.login}`,
        changedFiles,
      });

      console.log(`${LOG} PR #${pr.number}: Risk=${assessment.riskScore} Decision=${assessment.decision}`);
    }
  }

  if (action === "closed" && !pr.merged) {
    console.log(`${LOG} PR #${pr.number}: Closed without merge`);
    await logFileSignal(repoId, `pr-${pr.number}`, "pr_reverted", { prNumber: pr.number });
  }
}

async function handleCheckRun(payload: GitHubCheckRunPayload): Promise<void> {
  const { check_run: checkRun, repository } = payload;
  const repoId = repository.full_name;

  if (checkRun.conclusion === "failure") {
    console.log(`${LOG} Check failed: ${repoId} at ${checkRun.head_sha}`);

    await logCIFailure(repoId, "_commit_", "check_run_failure", checkRun.name, checkRun.details_url);
    await publishFileSignal(repoId, "_ci_failure_", {
      type: "ci_failure",
      checkName: checkRun.name,
      sha: checkRun.head_sha,
    });
  }
}

async function handleWorkflowRun(payload: GitHubWorkflowRunPayload): Promise<void> {
  const { workflow_run: workflow, repository } = payload;
  const repoId = repository.full_name;

  if (workflow.conclusion === "failure") {
    console.log(`${LOG} Workflow failed: "${workflow.name}" in ${repoId}`);
    await logCIFailure(repoId, workflow.path || "_workflow_", "workflow_failure", workflow.name, workflow.html_url);
  }
}

async function handleInstallation(payload: GitHubInstallationPayload): Promise<void> {
  const { action, repositories, repositories_added } = payload;
  const repos = repositories || repositories_added || [];

  console.log(`${LOG} Installation ${action}: ${repos.length} repos`);

  for (const repo of repos) {
    console.log(`${LOG} Auto-connecting: ${repo.full_name}`);
  }
}
