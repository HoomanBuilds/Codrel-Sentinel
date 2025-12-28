#!/usr/bin/env node
import { program } from "commander";
import { orchestrate, ProcessParams } from "./orchestration.js";

type CreateArgs = {
  repo?: string;
  url?: string;
  files?: string;
  dir?: string;
  token?: string;
  chunkSize?: string;
  name?: string;
  projectId?: string;
  local?: boolean;
  sitemap?: string;
  pattern?: string;
};

program.name("rag").description("RAG CLI").version("0.1.0");

program
  .command("ingest")
  .option("--repo <url>", "git repo (comma-separated for multiple)")
  .option("--url <urls>", "remote URLs (comma-separated)")
  .option("--files <files>", "files path (comma-separated)")
  .option("--dir <path>", "local folder path (comma-separated)")
  .option("--chunkSize <number>", "chunk size")
  .option("--name <name>", "project name")
  .option("--sitemap <yamlFile>", "sitemap yaml file path")
  .option("--projectId <name>", "project projectId")
  .option("--local", "local or cloud project")
  .option("--pattern <glob>", "filter URLs, e.g. '/docs/*'")
  .requiredOption("--token <t>", "auth token")
  .action(async (opts: CreateArgs) => {
    if (!opts.repo && !opts.url && !opts.files && !opts.dir && !opts.sitemap) {
      console.error(
        "error: at least one of --repo, --url, --files, --dir required"
      );
      process.exit(1);
    }

    const params: ProcessParams = {
      repo: opts.repo ? opts.repo.split(",").map((s) => s.trim()) : undefined,
      url: opts.url ? opts.url.split(",").map((s) => s.trim()) : undefined,
      files: opts.files
        ? opts.files.split(",").map((s) => s.trim())
        : undefined,
      folder: opts.dir ? opts.dir.split(",").map((s) => s.trim()) : undefined,
      token: opts.token!,
      chunkSize: opts.chunkSize ? parseInt(opts.chunkSize) : undefined,
      name: opts.name ? opts.name : undefined,
      projectId: opts.projectId ? opts.projectId : undefined,
      local: opts.local === true,
      sitemap: opts.sitemap ? opts.sitemap : undefined,
      pattern: opts.pattern ? opts.pattern : undefined,
    };

    await orchestrate(params);
  });

program.parse();
