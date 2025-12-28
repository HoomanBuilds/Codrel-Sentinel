import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function processNode(n: any): Promise<void> {
  const s = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 200,
  });

  if (n.type === "file") {
    const full = n.rawContent;
    const pieces = await s.splitText(full);

    const overlap = 200;
    let cursor = 0;

    n.chunks = pieces.map((txt, i) => {
      const start = cursor;
      const end = start + txt.length;

      cursor = end - overlap; 

      const startLine = full.slice(0, start).split("\n").length;
      const endLine = startLine + txt.split("\n").length - 1;

      const ext = path.extname(n.path).replace(".", "");
      const rel = n.path.split(path.sep);

      return {
        id: `${n.path.replace(/[/\\]/g, "__")}_c${i}__${crypto.randomUUID().slice(0, 6)}`,
        chunkIdx: i,
        filePath: n.path,
        relativePath: n.path,
        extension: ext,
        language: guessLang(ext),
        startLine,
        endLine,
        treePath: rel,
        text: txt,
        tokenLength: Math.ceil(txt.length / 4),
      };
    });

    delete n.rawContent;
    return;
  }

  if (n.children) for (const ch of n.children) await processNode(ch);
}


export async function buildChunkedTree(tree: any) {
  await processNode(tree);
  return tree;
}

function guessLang(ext: string) {
  const map: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c-header",
    cpp: "cpp",
    cs: "csharp",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    html: "html",
    css: "css",
    md: "markdown",
  };
  return map[ext] || "text";
}
