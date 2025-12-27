import { Request, Response } from "express";
import { z } from "zod";
import { saveFileMetadata, getFileMetadata } from "../../services/db.js";
import { publishFileSignal } from "../../services/kafkaProducer.js";
import { logCIFailure, logRequest } from "../../services/datadog.js";
import { logPrefix } from "../utils.js";

const LOG = logPrefix("Actions");

const ActionsWebhookSchema = z.object({
  repoId: z.string(),
  workflowName: z.string(),
  status: z.enum(["success", "failure"]),
  runId: z.number(),
  sha: z.string(),
  branch: z.string(),
  changedFiles: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
  runUrl: z.string().optional(),
});

export async function handleCIWebhook(req: Request, res: Response) {
  try {
    const payload = ActionsWebhookSchema.parse(req.body);
    console.log(`${LOG} ${payload.workflowName}: ${payload.status}`);

    if (payload.status === "failure") {
      await handleFailure(payload);
    }

    await logRequest("/webhooks/ci", "POST", 200, 0, { status: payload.status });
    res.json({ received: true, status: payload.status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid payload", details: err.errors });
    }
    throw err;
  }
}

async function handleFailure(payload: z.infer<typeof ActionsWebhookSchema>): Promise<void> {
  const { repoId, workflowName, changedFiles, errorMessage, runUrl, sha } = payload;

  await logCIFailure(repoId, sha, "actions_failure", workflowName, runUrl);

  if (changedFiles?.length) {
    await Promise.all(changedFiles.map((f) => bumpFailureCount(repoId, f)));
    await publishFileSignal(repoId, "_batch_", { type: "actions_failure", workflow: workflowName, files: changedFiles });
  }

  console.log(`${LOG} Failure: ${workflowName} - ${changedFiles?.length || 0} files affected`);
}

async function bumpFailureCount(repoId: string, filePath: string): Promise<void> {
  const existing = await getFileMetadata(repoId, filePath);
  await saveFileMetadata({
    repoId,
    filePath,
    ciFailures: (existing?.ciFailures || 0) + 1,
    revertedPrs: existing?.revertedPrs || 0,
    changeFrequency: existing?.changeFrequency || 0,
    lastModified: new Date(),
  });
}
