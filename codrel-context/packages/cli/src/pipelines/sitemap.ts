import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { buildChunkedTree } from "../core/tree/buildChunkedTree.js";
import { Logger } from "../lib/logger.js";
import { Context } from "../core/context.js";
import { ProcessParams } from "../orchestration.js";
import { minimatch } from "minimatch";

/** Robust extractor: Readability → main → prose → raw */
function extractReadable(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // 1. Readability
  const reader = new Readability(doc);
  const article = reader.parse();
  const txt = article?.textContent?.trim() || "";
  if (txt.split(/\s+/).length > 30) return txt;

  // 2. Kiro docs: #app main
  const main = doc.querySelector("#app main");
  if (main) {
    const t = main.textContent?.trim() || "";
    if (t.length > 0) return t;
  }

  // 3. Fallback prose/selectors
  const prose = doc.querySelector(".prose, article, .markdown-body");
  if (prose) {
    const t = prose.textContent?.trim() || "";
    if (t.length > 0) return t;
  }

  return txt;
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl);
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
}

export async function processSitemap(
  sitemapUrl: string,
  ctx: Context,
  _params: ProcessParams
): Promise<void> {
  const log = new Logger(`sitemap:${sitemapUrl}`, ctx);

  const patterns = ctx.pattern
    ? ctx.pattern.split(",").map(p => p.trim()).filter(Boolean)
    : [];

  log.info("fetching sitemap");
  let urls = await fetchSitemapUrls(sitemapUrl);

  if (patterns.length) {
    urls = urls.filter(u => {
      const p = new URL(u).pathname;
      return patterns.some(glob => minimatch(p, glob));
    });
  }

  if (!urls.length) {
    log.warn("no urls matched");
    return;
  }

  for (const url of urls) {
    const ulog = new Logger(`url:${url}`, ctx);

    ulog.info("fetching");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let html = "";
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      html = await res.text();
    } catch {
      clearTimeout(timeoutId);
      ulog.warn("fetch failed");
      continue;
    }

    ulog.info("extracting");
    const content = extractReadable(html, url);
    if (!content) {
      ulog.warn("no extractable text");
      continue;
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

    ulog.info("chunking");
    await buildChunkedTree(tree);

    ctx.addTree(url, "url", tree);
    ulog.info("complete");
  }

  log.info("done");
}

export default processSitemap;
