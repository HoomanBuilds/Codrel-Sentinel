import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { buildChunkedTree } from "../core/tree/buildChunkedTree.js";
import { Logger } from "../lib/logger.js";
import { Context } from "../core/context.js";
import { ProcessParams } from "../orchestration.js";

function extractReadable(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  return article?.textContent?.trim() || "";
}

export async function processUrl(
  url: string,
  ctx: Context,
  params: ProcessParams
): Promise<void> {
  const log = new Logger(`url:${url}` , ctx);

  log.info("fetching");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let html: string;
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    html = await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    log.warn("fetch failed");
    return;
  }

  log.info("extracting");
  const content = extractReadable(html, url);
  if (!content) {
    log.warn("no extractable text");
    return;
  }

  const tree = {
    type: "folder",
    path: ".",
    children: [
      {
        type: "file",
        path: "page.txt",
        rawContent: content,
        chunks: []
      }
    ]
  };

  log.info("chunking");
  await buildChunkedTree(tree);

  ctx.addTree(url, "url", tree);
  log.info("complete");
}

export default processUrl;
