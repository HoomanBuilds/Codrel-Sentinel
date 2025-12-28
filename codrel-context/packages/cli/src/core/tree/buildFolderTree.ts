import fs from "fs";
import path from "path";
import { BINARY_EXT, IGNORE_LIST } from "../ignore.js";

function loadLocalIgnore(dir: string): Set<string> {
  const p = path.join(dir, ".gitignore");
  if (!fs.existsSync(p)) return new Set<string>();

  const out = new Set<string>();
  for (let l of fs.readFileSync(p, "utf8").split("\n")) {
    l = l.trim();
    if (!l || l.startsWith("#")) continue;
    out.add(l.replace(/\/+$/, ""));
  }
  return out;
}

function isIgnored(rel: string, ignore: Set<string>) {
  const parts = rel.split(path.sep);
  const last = parts[parts.length - 1];
  if (ignore.has(last)) return true;
  for (const p of parts) if (ignore.has(p)) return true;
  return false;
}

function isBinary(f: string) {
  return BINARY_EXT.has(path.extname(f).toLowerCase());
}

function walk(root: string, rel: string, ignoreSet: Set<string>): any {
  const abs = path.join(root, rel);
  const st = fs.statSync(abs);

  if (!st.isDirectory()) return null;
  if (isIgnored(rel, ignoreSet)) return null;

  const node: any = { type: "folder", path: rel, children: [] };

  for (const name of fs.readdirSync(abs)) {
    const childRel = path.join(rel, name);
    const childAbs = path.join(root, childRel);

    if (isIgnored(childRel, ignoreSet)) continue;

    const st2 = fs.statSync(childAbs);

    if (st2.isDirectory()) {
      const sub = walk(root, childRel, ignoreSet);
      if (sub) node.children.push(sub);
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

export async function buildTreeFromFolder(folderPath: string) {
  const abs = path.resolve(folderPath);

  const ignoreSet = new Set([
    ...IGNORE_LIST,
    ...loadLocalIgnore(abs)
  ]);

  return walk(abs, ".", ignoreSet);
}

export default buildTreeFromFolder;
