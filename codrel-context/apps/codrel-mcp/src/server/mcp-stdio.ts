import { envConfig } from "../config/env.js";
import { createStdioMcpServer, createStdioMcpTransport } from "./server.js";

export const stdioMcpHandler = async () => {

  const token = getToken()
  const pick = envConfig.codrel.pick || 5;

  if(!token) return
  const server = createStdioMcpServer(token , { pick });
  await createStdioMcpTransport(server);
  console.error("codrelAi stdio mcp server running");
};


stdioMcpHandler();

function getToken() {
  return envConfig.codrel.token
}