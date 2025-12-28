import { App } from "octokit";
import fs from "fs";
import path from "path";

function getPrivateKey() {
  if (process.env.GITHUB_PRIVATE_KEY) return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  
  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    try {
      const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
      return fs.readFileSync(keyPath, "utf-8");
    } catch (err) {
      console.error(`❌ FATAL: Could not read private key from path: ${process.env.GITHUB_PRIVATE_KEY_PATH}`);
      throw err;
    }
  }
  throw new Error("Missing GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH");
}

const sentinelApp = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: getPrivateKey(),
});

export const github = {
  listInstallations: async () => {
    try {
      const { data } = await sentinelApp.octokit.request("GET /app/installations");
      return data;
    } catch (e: any) {
      console.error("❌ Error listing installations:", e.message);
      return [];
    }
  },

  listRepos: async (installationId: number) => {
  const octokit = await sentinelApp.getInstallationOctokit(installationId);
  const { data } = await octokit.request("GET /installation/repositories");
  return data.repositories;
}
};