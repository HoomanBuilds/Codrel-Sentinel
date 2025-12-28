import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function log(msg: string) {
  const home = os.homedir();
  const dir = path.join(home, ".codrel");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, "logs.txt"),
    `[${new Date().toISOString()}] ${msg}\n`
  );
}

async function downloadFile(url: string, dest: string) {
  const res = (await fetch(url)) as any; // tell TS “trust me”

  if (!res.ok) throw new Error(`Failed: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function getMcpJsonPath(): string {
  const home = os.homedir();
  const app = vscode.env.appName.toLowerCase();

  if (app.includes("kiro")) {
    const kiroPath = path.join(home, ".kiro", "settings", "mcp.json");
    fs.mkdirSync(path.dirname(kiroPath), { recursive: true });
    return kiroPath;
  }

  let base: string;

  if (process.platform === "win32") {
    base = path.join(home, "AppData", "Roaming", "Code", "User");
  } else if (process.platform === "darwin") {
    base = path.join(home, "Library", "Application Support", "Code", "User");
  } else {
    base = path.join(home, ".config", "Code", "User");
  }

  const p = path.join(base, "mcp.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

function registerMcp(serverPath: string) {
  const mcpPath = getMcpJsonPath();
  const isKiro = vscode.env.appName.toLowerCase().includes("kiro");

  let data: any;
  if (fs.existsSync(mcpPath)) {
    try {
      data = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    } catch {
      data = isKiro ? { mcpServers: {} } : { servers: {}, inputs: [] };
    }
  } else {
    data = isKiro ? { mcpServers: {} } : { servers: {}, inputs: [] };
  }

  const container = isKiro ? data.mcpServers : data.servers;
  const key = "codrelAi";

  // Create if missing
  if (!container[key]) {
    container[key] = isKiro
      ? {
          command: "node",
          args: [serverPath],
          env: {},
          disabled: false,
          autoApprove: ["*"],
          disabledTools: [],
        }
      : {
          type: "stdio",
          command: "node",
          args: [serverPath],
          env: {},
        };
  }

  // Always ensure env exists
  if (!container[key].env) container[key].env = {};

  fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2));
}

async function autoInstallAgent(context: vscode.ExtensionContext) {
  const storageDir = context.globalStorageUri.fsPath;
  const agentDir = path.join(storageDir, "codrel-agent");
  const distFile = path.join(agentDir, "mcp-stdio.js");

  if (fs.existsSync(distFile)) {
    log("Agent already installed.");
    return distFile;
  }

  //TODO Later use
  const officialUrl =
    "https://github.com/HoomanBuilds/codrel/blob/main/apps/codrel-ide-extension/codrel.extension.js";

  const fileUrl =
    "https://raw.githubusercontent.com/vinitngr/codrel-mcp-reg/refs/heads/main/mcp-stdio.js";

  log("Downloading Codrel Agent...");

  fs.mkdirSync(agentDir, { recursive: true });
  await downloadFile(fileUrl, distFile);

  log("Agent ready (bundled, no dependencies).");

  return distFile;
}

export function updateEnvInMcpConfig(key: string, value: string) {
  if (!key || !value) return;

  const mcpPath = getMcpJsonPath();
  const app = vscode.env.appName.toLowerCase();
  const isKiro = app.includes("kiro");

  if (!fs.existsSync(mcpPath)) {
    log("MCP file missing while saving env.");
    return;
  }

  let data: any;
  try {
    data = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  } catch {
    log("Invalid mcp.json while saving env.");
    return;
  }

  if (isKiro) {
    if (!data.mcpServers || !data.mcpServers["codrelAi"]) return;
    if (!data.mcpServers["codrelAi"].env) data.mcpServers["codrelAi"].env = {};
    data.mcpServers["codrelAi"].env[key] = value;
  } else {
    if (!data.servers || !data.servers["codrelAi"]) return;
    if (!data.servers["codrelAi"].env) data.servers["codrelAi"].env = {};
    data.servers["codrelAi"].env[key] = value;
  }

  fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2));
  log(`Env updated: ${key}=${value}`);
}

function appendKiroSteering(
  steeringFile: string,
  name: string,
  description: string,
  collectionId: string
) {
  const header = `---
inclusion: always
---

use these context with codrelAI mcp tool to get relavent context when needed
# Codrel Context registry

name | description | collectionId
---- | ----------- | ------------
`;

  const row = `${name} | ${description} | ${collectionId}\n`;

  if (!fs.existsSync(steeringFile)) {
    fs.mkdirSync(path.dirname(steeringFile), { recursive: true });
    fs.writeFileSync(steeringFile, header + row);
    return;
  }

  const content = fs.readFileSync(steeringFile, "utf8");
  if (content.includes(`${name} |`)) return;

  fs.appendFileSync(steeringFile, row);
}

function appendCopilotSteering(
  root: string,
  name: string,
  description: string,
  collectionId: string
) {
  const file = path.join(root, ".github", "copilot-instructions.md");

  const dir = path.dirname(file);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const header = `# Codrel Context Tools (Copilot)

name | description | collectionId
---- | ----------- | ------------
`;

  const row = `${name} | ${description} | ${collectionId}\n`;

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, header + row);
    return;
  }

  const content = fs.readFileSync(file, "utf8");
  if (content.includes(`${name} |`)) return;

  fs.appendFileSync(file, row);
}

function getWorkspaceRoot(): string | null {
  const ws = vscode.workspace.workspaceFolders;
  return ws?.[0]?.uri.fsPath || null;
}

export {
  log,
  registerMcp,
  autoInstallAgent,
  appendKiroSteering,
  appendCopilotSteering,
  getWorkspaceRoot,
};
