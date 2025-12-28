import { Context } from "../core/context.js";
import { buildChunkedTree } from "../core/tree/buildChunkedTree.js";
import { buildTreeFromRepo } from "../core/tree/buildTreeRepo.js";
import { Logger } from "../lib/logger.js";
import { ProcessParams } from "../orchestration.js";

export async function processRepo(
  repo: string,
  ctx: Context,
  params: ProcessParams
): Promise<void> {
  const log = new Logger(`repo:${repo}` , ctx);

  log.info("building tree");
  const raw = await buildTreeFromRepo(repo);

  log.info("chunking");
  const tree = await buildChunkedTree(raw);

  ctx.addTree(repo, "repo", tree);
  log.info("complete");
}

export default processRepo;
