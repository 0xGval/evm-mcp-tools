/**
 * Ethereum Tools for Claude MCP
 * 
 * This is the main entry point for the Ethereum Tools server. It initializes the
 * MCP server, sets up Web3 connectivity, and registers the various tools for
 * smart contract analysis, balance checking, and blockchain data retrieval.
 * 
 * Environment variables required:
 * - ETH_RPC_URL: Ethereum RPC endpoint
 * - MORALIS_API_KEY: API key for Moralis
 * - ETHERSCAN_API_KEY: API key for Etherscan
 * 
 * @module ethereum-tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Web3 } from "web3";
import dotenv from "dotenv";
import https from 'https';

// Import tool registration functions
import { registerAuditTool } from "./tools/audit.js";
import { registerBalanceTools } from "./tools/balance.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerProfitabilityTools } from "./tools/profitability.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerTokenAnalysisTools } from "./tools/token-analysis.js";
import { registerTwitterTools } from "./tools/twitter.js";

// Add global error handling to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION in main.js:', err);
});

// Load environment variables from .env file
dotenv.config();

// Show environment variable status for debugging
console.error('Environment variables loaded:');
console.error('- ETH_RPC_URL present:', !!process.env.ETH_RPC_URL);
console.error('- MORALIS_API_KEY present:', !!process.env.MORALIS_API_KEY);
console.error('- ETHERSCAN_API_KEY present:', !!process.env.ETHERSCAN_API_KEY);

// Create an MCP server with metadata
const server = new McpServer({
  name: "Ethereum Tools",
  version: "1.0.0"
});

// Initialize Web3 with the provider from .env or fallback
// Added check to handle template literals that weren't properly substituted
const eth_rpc = process.env.ETH_RPC_URL;
const web3 = new Web3(
  (eth_rpc && !eth_rpc.includes("${")) ? eth_rpc : 'https://eth.llamarpc.com'
);

// Register all tools - each tool group is managed in a separate module
registerUtilityTools(server);
registerBalanceTools(server, web3);
registerTokenTools(server);
registerProfitabilityTools(server);
registerAuditTool(server);
registerTokenAnalysisTools(server);
registerTwitterTools(server);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

// Connect the server to the transport
await server.connect(transport);