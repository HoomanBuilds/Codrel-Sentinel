# Codrel AI Devtools

A small utility extension that links the Codrel backend with VS Code and Kiro IDE.  
It installs and registers the Codrel MCP server, and it creates workspace-level context files that AI agents can read.

Codrel provides context collections (“tools”).  
This extension simply exposes them to the editor.

## Features

- **MCP Server Setup**  
  Installs the bundled Codrel MCP server (`mcp-stdio.cjs`) and registers it automatically.

- **Workspace Context Files**  
  Adds tool entries to:
  - Kiro → `.kiro/steering/codrel-tools.md`
  - VS Code → `.github/copilot-instructions.md`

- **Token Storage**  
  Saves your Codrel API token to the editor environment for use by the MCP server.

## Commands

| Command                     | Description |
|-----------------------------|-------------|
| `Codrel: Add Context Tool` | Add a Codrel tool entry to workspace context files |
| `Codrel: Set API Token`    | Store the Codrel API token |

Access via **Ctrl+Shift+P**.

## Notes

- Requires VS Code ≥1.106 or Kiro IDE  
- Requires a Codrel API token  
- MCP server files/settings are stored in the editor’s global storage  