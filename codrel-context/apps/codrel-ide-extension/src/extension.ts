import * as vscode from "vscode";
import * as fs from "fs";
import {
  registerMcp,
  autoInstallAgent,
  log,
  getWorkspaceRoot,
  appendKiroSteering,
  appendCopilotSteering,
  updateEnvInMcpConfig,
} from "./utils";
import path from "path";

export async function activate(context: vscode.ExtensionContext) {
  log("Codrel extension activated.");
  const distFile = await autoInstallAgent(context);

  if (!fs.existsSync(distFile)) {
    vscode.window.showErrorMessage("Codrel MCP server missing after build.");
    log("ERROR: Missing mcp-stdio.cjs");
    return;
  }

  registerMcp(distFile);

  vscode.window.showInformationMessage(
    "Codrel Agent installed & MCP registered."
  );

  const setToken = vscode.commands.registerCommand(
    "codrel.setToken",
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Enter Codrel API token",
        password: true,
      });
      if (!token) return;

      updateEnvInMcpConfig("CODREL_TOKEN", token);

      vscode.window.showInformationMessage("Codrel token saved to MCP config.");
      log("Token saved to MCP env.");
    }
  );

  const addContext = vscode.commands.registerCommand(
    "codrel.addContext",
    async () => {
      const name = await vscode.window.showInputBox({ prompt: "Tool name" });
      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: "Description",
      });
      if (!description) return;

      const collectionId = await vscode.window.showInputBox({
        prompt: "Collection ID",
      });
      if (!collectionId) return;

      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage("No workspace open.");
        return;
      }

      const isKiro = vscode.env.appName.toLowerCase().includes("kiro");

      if (isKiro) {
        const steeringPath = path.join(
          root,
          ".kiro",
          "steering",
          "kiro.instructions.md"
        );
        appendKiroSteering(steeringPath, name, description, collectionId);

        vscode.window.showInformationMessage(
          `Codrel tool '${name}' added to Kiro steering.`
        );
        log(`Added Kiro steering entry for ${name}`);
        return;
      }

      appendCopilotSteering(root, name, description, collectionId);
      vscode.window.showInformationMessage(
        `Codrel tool '${name}' added to Copilot steering.`
      );
      log(`Added Copilot steering entry for ${name}`);
    }
  );

  const setPICK = vscode.commands.registerCommand("codrel.setPICK", async () => {
    const val = await vscode.window.showInputBox({
      prompt: "Pick (1–15).",
    });
    if (val === undefined) return;

    setTimeout(() => {
      if (val.trim() === "") {
        context.globalState.update("codrel.pick", undefined);
        return;
      }

      const k = Number(val);
      if (Number.isInteger(k) && k >= 1 && k <= 15) {
        updateEnvInMcpConfig("CODREL_PICK", k.toString());
      }
    }, 0);
  });


  context.subscriptions.push(setPICK);
  context.subscriptions.push(addContext);
  context.subscriptions.push(setToken);
}

export function deactivate() {
  log("Codrel extension deactivated.");
}
