import "dotenv/config";
import { consumer } from "./kafka";

import { processArchitecture } from "./processors/architecture";
import { processIssues, log as Vectorlog } from "./processors/issues";
import { processWorkflowCrash } from "./processors/workflow-crash";
import { processRejectedPrs } from "./processors/rejected-pr";
import { processRevertedPrs } from "./processors/reverted-pr";

import { initDB, updateStatus, markFailed } from "./lib/db/db";
import { FileRiskEvent, recordFileEventsBatch } from "./lib/db/record_file_event";

const TOPIC = "repo.analysis.ai";

async function safeRun(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    Vectorlog("error", `Task [${name}] failed: ${error}`);
  }
}


async function main() {
  initDB();

  Vectorlog("connection", "🔌 Connecting to Kafka...");
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  Vectorlog("connection", "✅ Consumer connected. Waiting for jobs...");

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      
      const offset = message.offset;
      let repo : string = "";

      try {
        const payload = JSON.parse(message.value.toString());

        repo = payload.repo || payload.repository || "unknown"; 
        
        Vectorlog("Job", `🚀 STARTING JOB | repo=${repo} | offset=${offset}`);
        const startTime = Date.now();

        await updateStatus(repo, "ANALYZING");

        const issues = payload.bug?.Issues || payload.bug?.issues || [];
        const files = payload.rule?.Files || payload.rule?.files || [];
        const crashes = payload.workflow_crash?.Crash || [];
        const rejectedPrs = payload.rejected_prs || [];
        const revertedPrs = payload.reverted_prs || [];

        
        const eventBuffer: FileRiskEvent[] = [];
        const tasks = [
          safeRun("Issues", async () => {
            if (issues.length) await processIssues(repo, issues);
          }),

          safeRun("Architecture", async () => {
            if (files.length) await processArchitecture(repo, files);
          }),

          safeRun("Workflow", async () => {
            if (crashes.length) {
               await processWorkflowCrash(message, eventBuffer); 
            }
          }),

          safeRun("RejectedPRs", async () => {
            if (rejectedPrs.length) await processRejectedPrs(repo, rejectedPrs , eventBuffer);
          }),

          safeRun("RevertedPRs", async () => {
            if (revertedPrs.length) await processRevertedPrs(repo, revertedPrs, eventBuffer);
          })
        ];

        await Promise.allSettled(tasks);
        await recordFileEventsBatch(eventBuffer);
        await updateStatus(repo, "READY");

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        Vectorlog("Job", `✅ FINISHED JOB | repo=${repo} | time=${duration}s`);

      } catch (error: any) {
        Vectorlog("Critical", `🔥 MESSAGE FAILED | repo=${repo} | error=${error.message}`);
        
        if (repo !== "unknown") {
            await markFailed(repo, error.message || "Unknown worker error");
        }
      } finally {
        await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (Number(offset) + 1).toString(),
            },
        ]);
      }
    },
  });
}

main().catch(console.error);