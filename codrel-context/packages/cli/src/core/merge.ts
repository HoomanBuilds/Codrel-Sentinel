import { Context } from "./context.js";

export function mergeAllTrees(ctx: Context) {
  const out: Array<{
    source: string;
    type: "repo" | "folder" | "url" | "files";
    tree: any;
  }> = [];

  for (const key in ctx.repoTrees) {
    out.push({
      source: key,
      type: "repo",
      tree: ctx.repoTrees[key]
    });
  }

  for (const key in ctx.folderTrees) {
    out.push({
      source: key,
      type: "folder",
      tree: ctx.folderTrees[key]
    });
  }

  for (const key in ctx.urlTrees) {
    out.push({
      source: key,
      type: "url",
      tree: ctx.urlTrees[key]
    });
  }

  for (const key in ctx.fileTrees) {
    out.push({
      source: key,
      type: "files",
      tree: ctx.fileTrees[key]
    });
  }

  return out;
}
