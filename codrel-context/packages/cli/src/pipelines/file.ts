import fs from "fs";
import path from "path";
import { buildChunkedTree } from "../core/tree/buildChunkedTree.js";
import { Logger } from "../lib/logger.js";
import { Context } from "../core/context.js";
import { ProcessParams } from "../orchestration.js";

export async function processFiles(
  filePath: string,
  ctx: Context,
  params: ProcessParams
): Promise<void> {
  const log = new Logger(`file:${filePath}` , ctx);

  log.info("reading");

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    log.warn("read failed");
    return;
  }

  const rel = path.basename(filePath);

  const tree = {
    type: "folder",
    path: ".",
    children: [
      {
        type: "file",
        path: rel,
        rawContent: raw,
        chunks: []
      }
    ]
  };

  log.info("chunking");
  await buildChunkedTree(tree);

  ctx.addTree(filePath, "files", tree);
  log.info("complete");
}

export default processFiles;
