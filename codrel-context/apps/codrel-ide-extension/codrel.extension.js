"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));

// src/utils.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
function log(msg) {
  const home = os.homedir();
  const dir = path.join(home, ".codrel");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, "logs.txt"),
    `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`
  );
}
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}
function getMcpJsonPath() {
  const home = os.homedir();
  const app = vscode.env.appName.toLowerCase();
  if (app.includes("kiro")) {
    const kiroPath = path.join(home, ".kiro", "settings", "mcp.json");
    fs.mkdirSync(path.dirname(kiroPath), { recursive: true });
    return kiroPath;
  }
  let base;
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
function registerMcp(serverPath) {
  const mcpPath = getMcpJsonPath();
  const app = vscode.env.appName.toLowerCase();
  const isKiro = app.includes("kiro");
  let data = isKiro ? { mcpServers: {} } : { servers: {}, inputs: [] };
  if (fs.existsSync(mcpPath)) {
    try {
      data = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    } catch {
      log("Invalid mcp.json, recreating.");
    }
  }
  if (isKiro) {
    if (!data.mcpServers) data.mcpServers = {};
    data.mcpServers["codrelAi"] = {
      command: "node",
      args: [serverPath],
      env: {},
      disabled: false,
      autoApprove: ["*"],
      disabledTools: []
    };
  } else {
    if (!data.servers) data.servers = {};
    if (!data.inputs) data.inputs = [];
    data.servers["codrelAi"] = {
      type: "stdio",
      command: "node",
      args: [serverPath]
    };
  }
  fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
  fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2));
  log(`MCP registered: ${mcpPath} | mode=${isKiro ? "kiro" : "vscode-family"}`);
}
async function autoInstallAgent(context) {
  const storageDir = context.globalStorageUri.fsPath;
  const agentDir = path.join(storageDir, "codrel-agent");
  const distFile = path.join(agentDir, "mcp-stdio.js");
  if (fs.existsSync(distFile)) {
    log("Agent already installed.");
    return distFile;
  }
  const officialUrl = "https://github.com/HoomanBuilds/codrel/blob/main/apps/codrel-ide-extension/codrel.extension.js";
  const fileUrl = "https://raw.githubusercontent.com/vinitngr/codrel-mcp-reg/refs/heads/main/mcp-stdio.js";
  log("Downloading Codrel Agent...");
  fs.mkdirSync(agentDir, { recursive: true });
  await downloadFile(fileUrl, distFile);
  log("Agent ready (bundled, no dependencies).");
  return distFile;
}
function updateTokenInMcpConfig(token) {
  const mcpPath = getMcpJsonPath();
  const app = vscode.env.appName.toLowerCase();
  const isKiro = app.includes("kiro");
  if (!fs.existsSync(mcpPath)) {
    log("MCP file missing while saving token.");
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  } catch {
    log("Invalid mcp.json while saving token.");
    return;
  }
  if (isKiro) {
    if (!data.mcpServers || !data.mcpServers["codrelAi"]) return;
    if (!data.mcpServers["codrelAi"].env) data.mcpServers["codrelAi"].env = {};
    data.mcpServers["codrelAi"].env["CODREL_TOKEN"] = token;
  } else {
    if (!data.servers || !data.servers["codrelAi"]) return;
    if (!data.servers["codrelAi"].env) data.servers["codrelAi"].env = {};
    data.servers["codrelAi"].env["CODREL_TOKEN"] = token;
  }
  fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2));
  log("Token injected into MCP env.");
}
function appendKiroSteering(steeringFile, name, description, collectionId) {
  const header = `---
inclusion: always
---

# Codrel Context Tools

name | description | collectionId
---- | ----------- | ------------
`;
  const row = `${name} | ${description} | ${collectionId}
`;
  if (!fs.existsSync(steeringFile)) {
    fs.mkdirSync(path.dirname(steeringFile), { recursive: true });
    fs.writeFileSync(steeringFile, header + row);
    return;
  }
  const content = fs.readFileSync(steeringFile, "utf8");
  if (content.includes(`${name} |`)) return;
  fs.appendFileSync(steeringFile, row);
}
function appendCopilotSteering(root, name, description, collectionId) {
  const file = path.join(root, ".github", "copilot-instructions.md");
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const header = `# Codrel Context Tools (Copilot)

name | description | collectionId
---- | ----------- | ------------
`;
  const row = `${name} | ${description} | ${collectionId}
`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, header + row);
    return;
  }
  const content = fs.readFileSync(file, "utf8");
  if (content.includes(`${name} |`)) return;
  fs.appendFileSync(file, row);
}
function getWorkspaceRoot() {
  const ws = vscode.workspace.workspaceFolders;
  return ws?.[0]?.uri.fsPath || null;
}

var import_path = __toESM(require("path"));
async function activate(context) {
  log("Codrel extension activated.");
  const distFile = await autoInstallAgent(context);
  if (!fs2.existsSync(distFile)) {
    vscode2.window.showErrorMessage("Codrel MCP server missing after build.");
    log("ERROR: Missing mcp-stdio.cjs");
    return;
  }
  registerMcp(distFile);
  vscode2.window.showInformationMessage(
    "Codrel Agent installed & MCP registered."
  );
  const setToken = vscode2.commands.registerCommand("codrel.setToken", async () => {
    const token = await vscode2.window.showInputBox({
      prompt: "Enter Codrel API token",
      password: true
    });
    if (!token) return;
    updateTokenInMcpConfig(token);
    vscode2.window.showInformationMessage("Codrel token saved to MCP config.");
    log("Token saved to MCP env.");
  });
  const addContext = vscode2.commands.registerCommand(
    "codrel.addContext",
    async () => {
      const name = await vscode2.window.showInputBox({ prompt: "Tool name" });
      if (!name) return;
      const description = await vscode2.window.showInputBox({ prompt: "Description" });
      if (!description) return;
      const collectionId = await vscode2.window.showInputBox({ prompt: "Collection ID" });
      if (!collectionId) return;
      const root = getWorkspaceRoot();
      if (!root) {
        vscode2.window.showErrorMessage("No workspace open.");
        return;
      }
      const isKiro = vscode2.env.appName.toLowerCase().includes("kiro");
      if (isKiro) {
        const steeringPath = import_path.default.join(root, ".kiro", "steering", "kiro.instructions.md");
        appendKiroSteering(steeringPath, name, description, collectionId);
        vscode2.window.showInformationMessage(
          `Codrel tool '${name}' added to Kiro steering.`
        );
        log(`Added Kiro steering entry for ${name}`);
        return;
      }
      appendCopilotSteering(root, name, description, collectionId);
      vscode2.window.showInformationMessage(
        `Codrel tool '${name}' added to Copilot steering.`
      );
      log(`Added Copilot steering entry for ${name}`);
    }
  );
  context.subscriptions.push(addContext);
  context.subscriptions.push(setToken);
}
function deactivate() {
  log("Codrel extension deactivated.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
