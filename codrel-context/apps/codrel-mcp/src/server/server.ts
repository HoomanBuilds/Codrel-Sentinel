import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getCodrelTools } from "../tools/tools.js";

export function createStdioMcpServer(token : string , options : { pick: number }) {
  const server = new McpServer({
    name: "@codrel-mcp",
    version: "1.0.0",
  });
  let allTools : Record<string, { tool: any; handler: any }> = {  ...getCodrelTools(token, { pick: options.pick }) };
  
  console.error("🛠️ Registering Codrel MCP tools..." , token);
  console.error("🔍 Tools available before registration:", Object.keys(allTools));

  for (const [name, data] of Object.entries(allTools)) {
    if (!data || typeof data !== "object" || !data.tool || !data.handler) {
      console.error(`⚠️ Skipping invalid tool: ${name}`);
      continue;
    }
    try {
      server.registerTool(name, data.tool as any, data.handler as any);
      console.error(`✅ Registered tool: ${name}`);
    } catch (err) {
      console.error(`❌ Failed to register tool: ${name}`, err);
    }
  }

  return server;
}

export async function createStdioMcpTransport(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return transport;
}
