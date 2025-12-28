import path from "path";
import fs from "fs/promises";
import os from "os";

const ROOT = path.join(os.homedir(), ".codrel");

export interface ContextState {
  projectLocalId: string;
  remoteProjectId : string | null;
  commitHash: string | null;
  pipelineVersion: number;
  meta: Record<string, unknown>;
  warnings: string[];
  token?: string | null;

  indexSummary?: unknown;
  tokenLength?: number;
  logs?: string[];
  name ?: string;
  local?: boolean;

  sitemap?: string | null;
  pattern?: string | null;
}

export class Context {
  readonly projectLocalId: string;
  readonly baseDir: string;
  readonly token: string | null = null;

  remoteProjectId : string | null = null;
  commitHash: string | null = null;
  indexSummary: unknown = null;
  meta: Record<string, unknown> = {};
  warnings: string[] = [];

  name: string = "Untitled Project";
  repoTrees: Record<string, unknown> = {};
  folderTrees: Record<string, unknown> = {};
  urlTrees: Record<string, unknown> = {};
  fileTrees: Record<string, unknown> = {};

  allChunks: unknown[] = [];
  pipelineVersion = 1;
  logs: string[] = [];

  sitemap: string | null = null;
  pattern: string | null = null;

  local = false;

  constructor(projectLocalId: string, token?: string) {
    this.projectLocalId = projectLocalId;
    this.token = token || null;
    this.baseDir = path.join(ROOT, "projects", projectLocalId);
  }

  addLog(line: string) {
    this.logs.push(line);
  }

  async init(): Promise<void> {
    if(this.local) {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  file(name: string): string {
    return path.join(this.baseDir, name);
  }

  async write(name: string, data: unknown): Promise<void> {
    await fs.writeFile(this.file(name), JSON.stringify(data, null, 2));
  }

  async read<T = unknown>(name: string): Promise<T> {
    return JSON.parse(await fs.readFile(this.file(name), "utf8")) as T;
  }

  addTree(
    source: string,
    type: "repo" | "folder" | "url" | "files",
    tree: unknown
  ): void {
    if (type === "repo") this.repoTrees[source] = tree;
    if (type === "folder") this.folderTrees[source] = tree;
    if (type === "url") this.urlTrees[source] = tree;
    if (type === "files") this.fileTrees[source] = tree;
  }

  async saveState(): Promise<void> {
    const state: ContextState = {
      projectLocalId: this.projectLocalId,
      remoteProjectId : this.remoteProjectId ,
      commitHash: this.commitHash,
      pipelineVersion: this.pipelineVersion,
      meta: this.meta,
      warnings: this.warnings,
    };

    await this.write("state.json", state);
  }

  toJSON() {
    return {
      projectLocalId: this.projectLocalId,
      remoteProjectId : this.remoteProjectId ,
      commitHash: this.commitHash,
      indexSummary: this.indexSummary,
      meta: this.meta,
      warnings: this.warnings,

      repoTrees: this.repoTrees,
      folderTrees: this.folderTrees,
      urlTrees: this.urlTrees,
      fileTrees: this.fileTrees,

      allChunks: this.allChunks,
      pipelineVersion: this.pipelineVersion,
    };
  }

  async addToGlobalMapping(): Promise<void> {
    const mappingPath = path.join(ROOT, "projects", "mapping.json");

    let map: Record<string, string> = {};
    try {
      const txt = await fs.readFile(mappingPath, "utf8");
      map = JSON.parse(txt);
    } catch (_) {
      map = {};
    }

    if (this.remoteProjectId ) {
      map[this.remoteProjectId ] = this.projectLocalId;
    }

    await fs.writeFile(mappingPath, JSON.stringify(map, null, 2));
  }

  static async getLocalId(serverId: string): Promise<string | null> {
    const mappingPath = path.join(ROOT, "projects", "mapping.json");

    try {
      const map = JSON.parse(await fs.readFile(mappingPath, "utf8"));
      return map[serverId] ?? null;
    } catch {
      return null;
    }
  }
}

export default Context;
