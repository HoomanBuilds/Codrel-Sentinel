import "dotenv/config";
import { consumer } from "./kafka";
import { log, processIssues } from "./processors/issues";

const TOPIC = "repo.analysis.ai";

async function main() {
  console.log("🔌 Connecting to Kafka...");
  await consumer.connect();
  
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  log("Entry", "✅ Consumer connected and subscribed. Waiting for pending messages...");

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;

      const offset = message.offset;

      const payload = JSON.parse(message.value.toString());

      if (payload.bug?.Issues?.length) {
        log( "info",`Processing ${payload.bug.Issues.length} issues for repo: ${payload.repo}`);
        await processIssues(payload.repo, payload.bug.Issues);
      } else {
        log("info", `Payload received for ${payload.repo}, but no issues found. Skipping.`);
      }

      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: (Number(message.offset) + 1).toString(),
        },
      ]);
      log("exit", `✅ Offset ${offset} committed.`);
    },
  });
}

main();