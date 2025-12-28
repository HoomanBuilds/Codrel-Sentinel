import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { tempWorkspace } from "../../lib/tempWorkspace.js";
import { BINARY_EXT , IGNORE_LIST} from "../ignore.js";
import { logger } from "../../lib/logger.js";

function loadGitignore(r: string): Set<string> {
  const f = path.join(r, ".gitignore");
  if (!fs.existsSync(f)) return new Set<string>();
  const o = new Set<string>();
  for (let l of fs.readFileSync(f, "utf8").split("\n")) {
    l = l.trim();
    if (!l || l.startsWith("#")) continue;
    o.add(l.replace(/\/+$/, ""));
  }
  return o;
}

function isIgnored(rel: string, ig: Set<string>) {
  const seg = rel.split(path.sep);
  const f = seg[seg.length - 1];
  if (ig.has(f)) return true;
  for (const s of seg) if (ig.has(s)) return true;
  return false;
}

function isBinary(f: string) {
  return BINARY_EXT.has(path.extname(f).toLowerCase());
}

async function cloneRepo(url: string, temp: string) {
  const dst = path.join(temp, "_repo");
  const r = spawnSync("git", ["clone", "--depth", "1", url, dst], { stdio: "ignore" });
  if (r.status !== 0) throw new Error("clone failed");
  return dst;
}

function walk(root: string, rel: string, ig: Set<string>) {
  const abs = path.join(root, rel);
  const st = fs.statSync(abs);
  if (!st.isDirectory()) return null;
  if (isIgnored(rel, ig)) return null;

  const node: any = { type: "folder", path: rel, children: [] };

  for (const name of fs.readdirSync(abs)) {
    const childRel = path.join(rel, name);
    const childAbs = path.join(root, childRel);

    if (isIgnored(childRel, ig)) continue;

    const st2 = fs.statSync(childAbs);

    if (st2.isDirectory()) {
      const c = walk(root, childRel, ig);
      if (c) node.children.push(c);
    } else {
      if (isBinary(childAbs)) continue;
      const txt = fs.readFileSync(childAbs, "utf8");
      node.children.push({
        type: "file",
        path: childRel,
        rawContent: txt,
        chunks: []
      });
    }
  }

  return node;
}

export async function buildTreeFromRepo(repoUrl: string) {
  const temp = await tempWorkspace.create();
  try {
    logger.info(`cloning repo ${repoUrl}`);
    const repoPath = await cloneRepo(repoUrl, temp);
    logger.info(`cloned repo ${repoUrl}`);
    const ignore = new Set([...IGNORE_LIST, ...loadGitignore(repoPath)]);
    return walk(repoPath, ".", ignore);
  } finally {
    await tempWorkspace.cleanup(temp);
  }
}
