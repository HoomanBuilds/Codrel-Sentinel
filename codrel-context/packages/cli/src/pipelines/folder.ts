import { Logger } from "../lib/logger.js";
import { buildChunkedTree } from "../core/tree/buildChunkedTree.js";
import { Context } from "../core/context.js";
import { ProcessParams } from "../orchestration.js";
import buildTreeFromFolder from "../core/tree/buildFolderTree.js";

export async function processFolder(
  folder: string,
  ctx: Context,
  params: ProcessParams
): Promise<void> {
  const log = new Logger(`folder:${folder}` , ctx);

  log.info("building tree");
  const raw = await buildTreeFromFolder(folder);

  if (!raw) {
    log.warn("no tree built");
    return;
  }

  log.info("chunking");
  const tree = await buildChunkedTree(raw);

  ctx.addTree(folder, "folder", tree);
  log.info("complete");
}

export default processFolder;
