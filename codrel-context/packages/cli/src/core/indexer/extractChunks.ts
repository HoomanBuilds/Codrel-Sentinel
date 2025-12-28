import crypto from "crypto";
import path from "path";

function sha256(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export function extractChunks(tree: any) {
  const out: any[] = [];

  const walk = (n: any, depth = 0) => {
    if (n.type === "file" && Array.isArray(n.chunks)) {
      const parts = n.path.split(path.sep).slice(0, -1);
      const parent = parts[parts.length - 1] || null;
      const rank = computeFileRank(n.path);
      const count = n.chunks.length;

      for (let i = 0; i < count; i++) {
        const c = n.chunks[i];

        out.push({
          ...c,
          parentFolder: parent,
          depth,
          fileRank: rank,
          neighbors: [
            i > 0 ? n.chunks[i - 1].id : null,
            i < count - 1 ? n.chunks[i + 1].id : null
          ].filter(Boolean),
          hash: sha256(c.text),
          fileFullPath: n.path
        });
      }
    }

    if (n.children) for (const ch of n.children) walk(ch, depth + 1);
  };

  walk(tree);
  return out;
}

function computeFileRank(p: string) {
  const n = p.toLowerCase();
  let s = 1;
  if (n.includes("index")) s += 0.5;
  if (n.endsWith(".ts") || n.endsWith(".js")) s += 0.3;
  if (n.includes("route") || n.includes("api")) s += 0.3;
  if (n.includes("test") || n.includes("spec")) s -= 0.4;
  return s;
}
