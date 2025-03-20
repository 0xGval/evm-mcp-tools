import { z } from "zod";
import { Web3 } from "web3";

/**
 * Registers Ethereum balance tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 * @param {Web3} web3 - The initialized Web3 instance
 */
export function registerBalanceTools(server, web3) {
  // Add ETH balance tool
  server.tool("getEthBalance",
    { address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address") },
    async ({ address }) => {
      try {
        const balanceWei = await web3.eth.getBalance(address);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        return {
          content: [{ type: "text", text: `Balance for ${address}: ${balanceEth} ETH` }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching balance: ${error.message}` }]
        };
      }
    }
  );

  // Add transaction count (nonce) tool
  server.tool("getTransactionCount",
    { address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address") },
    async ({ address }) => {
      try {
        const transactionCount = await web3.eth.getTransactionCount(address);
        return {
          content: [{ type: "text", text: `Transaction count (nonce) for ${address}: ${transactionCount}` }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching transaction count: ${error.message}` }]
        };
      }
    }
  );
} 