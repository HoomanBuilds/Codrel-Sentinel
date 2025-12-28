import os from "os";
import fs from "fs/promises";
import path from "path";

export const tempWorkspace = {
  async create(): Promise<string> {
    const base = path.join(os.tmpdir(), "codrel-");
    return fs.mkdtemp(base);
  },

  async cleanup(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {}
  }
};
