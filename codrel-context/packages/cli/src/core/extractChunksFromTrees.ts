export function extractChunksFromTrees(
  merged: Array<{ source: string; type: string; tree: any }>
) {
  const out: any[] = [];

  for (const item of merged) {
    const { source, type, tree } = item;

    walk(tree, (node) => {
      if (node.type === "file" && Array.isArray(node.chunks)) {
        for (const chunk of node.chunks) {
          out.push({
            ...chunk,
            source,
            sourceType: type
          });
        }
      }
    });
  }

  return out;
}

function walk(node: any, cb: (node: any) => void) {
  cb(node);
  if (node.children) {
    for (const child of node.children) walk(child, cb);
  }
}
