import axios from "axios";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

export interface GitHubCredential {
  installationId: number;
  accessToken: string;
  expiresAt: string;
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
  repository_selection: string;
  created_at: string;
}

export class GitHubService {
  private appId: string;
  private appName: string;
  private privateKey: string;

  constructor() {
    this.appId = process.env.GITHUB_APP_ID || "";
    this.appName = process.env.GITHUB_APP_NAME || "";
    this.privateKey = this.loadPrivateKey();

    if (!this.appId || !this.appName || !this.privateKey) {
      console.warn("GitHub App credentials not fully configured");
    }
  }

  private loadPrivateKey(): string {
    const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
    if (keyPath) {
      try {
        return fs.readFileSync(path.resolve(keyPath), "utf8");
      } catch (err) {
        console.error("Failed to load private key from file:", keyPath);
      }
    }

    const envKey = process.env.GITHUB_PRIVATE_KEY || "";
    if (envKey.includes("-----BEGIN")) {
      return envKey.replace(/\\n/g, "\n");
    }

    if (envKey && !envKey.includes(" ") && !envKey.includes("\n")) {
      try {
        return Buffer.from(envKey, "base64").toString("utf8");
      } catch {}
    }
    return envKey.replace(/\\n/g, "\n");
  }

  getInstallUrl(state?: string): string {
    const baseUrl = `https://github.com/apps/${this.appName}/installations/new`;
    return state ? `${baseUrl}?state=${encodeURIComponent(state)}` : baseUrl;
  }

  createAppJWT(): string {
    if (!this.privateKey || !this.privateKey.includes("PRIVATE KEY")) {
      throw new Error("Invalid or missing GitHub private key. Set GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY in .env");
    }

    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iat: now - 60,
        exp: now + 600,
        iss: this.appId,
      },
      this.privateKey,
      { algorithm: "RS256" }
    );
  }

  async getInstallationToken(installationId: number): Promise<GitHubCredential> {
    const appJwt = this.createAppJWT();

    const res = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codrel-sentinel",
        },
      }
    );

    if (!res.data.token) {
      throw new Error("GitHub did not return access token");
    }

    return {
      installationId,
      accessToken: res.data.token,
      expiresAt: res.data.expires_at,
    };
  }

  async listInstallations(): Promise<GitHubInstallation[]> {
    const appJwt = this.createAppJWT();

    const res = await axios.get("https://api.github.com/app/installations", {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "codrel-sentinel",
      },
    });

    return res.data;
  }

  async getInstallation(installationId: number): Promise<GitHubInstallation> {
    const appJwt = this.createAppJWT();

    const res = await axios.get(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codrel-sentinel",
        },
      }
    );

    return res.data;
  }

  async listInstallationRepos(installationId: number): Promise<any[]> {
    const { accessToken } = await this.getInstallationToken(installationId);

    const res = await axios.get(
      "https://api.github.com/installation/repositories",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codrel-sentinel",
        },
      }
    );

    return res.data.repositories;
  }

  async getRepoContents(
    installationId: number,
    owner: string,
    repo: string,
    path: string = ""
  ): Promise<any> {
    const { accessToken } = await this.getInstallationToken(installationId);

    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codrel-sentinel",
        },
      }
    );

    return res.data;
  }
}

export const githubService = new GitHubService();
