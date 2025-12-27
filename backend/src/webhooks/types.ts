import { z } from "zod";

export interface GitHubWebhookHeaders {
  event: string;
  signature: string | undefined;
  deliveryId: string;
}

export interface GitHubPushPayload {
  repository: { full_name: string };
  commits: Array<{
    added?: string[];
    modified?: string[];
    removed?: string[];
  }>;
}

export interface GitHubPullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    user: { login: string };
    merged: boolean;
    changed_files_list?: string[];
  };
  repository: { full_name: string };
}

export interface GitHubCheckRunPayload {
  check_run: {
    conclusion: string;
    head_sha: string;
    name: string;
    details_url: string;
  };
  repository: { full_name: string };
}

export interface GitHubWorkflowRunPayload {
  workflow_run: {
    conclusion: string;
    name: string;
    path?: string;
    html_url: string;
  };
  repository: { full_name: string };
}

export interface GitHubInstallationPayload {
  action: string;
  installation: {
    id: number;
    account: { login: string };
  };
  repositories?: Array<{ full_name: string }>;
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}

export const DatadogWebhookSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  alert_type: z.string(),
  event_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  body: z.string().optional(),
});

export type DatadogWebhookPayload = z.infer<typeof DatadogWebhookSchema>;

export const CIWebhookSchema = z.object({
  provider: z.enum(["jenkins", "circleci", "gitlab", "azure", "generic"]),
  repoId: z.string(),
  status: z.enum(["success", "failure", "cancelled"]),
  branch: z.string().optional(),
  commit: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
  buildUrl: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type CIWebhookPayload = z.infer<typeof CIWebhookSchema>;
