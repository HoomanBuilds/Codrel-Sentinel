### MCP Integration (IDE Agents)

This repository includes a **lightweight MCP (Model Context Protocol) tool** that connects **Codrel Context** and **Codrel Sentinel** to IDE-based AI agents.

**Supported IDEs**
- VS Code
- Kiro

**What this MCP tool does**
- Exposes Sentinel’s **pre-built repository context** to agents
- Enables **file-level risk and historical failure queries**
- Acts as a thin stdio bridge — no reasoning or state lives here

---

### Setup

#### Option 1: Automatic (Recommended)

Install the **Codrel IDE Extension**.  
The extension automatically installs and configures the MCP server.

No manual configuration required.

---

#### Option 2: Manual MCP Configuration

Add the following MCP server configuration to your IDE:

```json
{
  "servers": {
    "codrelAi": {
      "type": "stdio",
      "command": "node",
      "args": [
        "$c:\\Users\\USERNAME\\AppData\\Roaming\\Code\\User\\globalStorage\\codrel-dev.codrel-ide-extension\\codrel-agent\\mcp-stdio.js"
      ],
      "env": {
        "CODREL_TOKEN": "<your-token>",
        "CODREL_TOP_K": "10"
      }
    }
  },
  "inputs": []
}
