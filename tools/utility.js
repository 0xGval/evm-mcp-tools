import { z } from "zod";

/**
 * Registers utility tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerUtilityTools(server) {
  // Add an addition tool
  server.tool("add",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }]
    })
  );
} 