import { z } from "zod";
import { exec } from 'child_process';
import { promisify } from 'util';

// Convert exec to promise-based
const execPromise = promisify(exec);

/**
 * Registers profitability analysis tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerProfitabilityTools(server) {
  // Add wallet profitability tool
  server.tool("getWalletPnl",
    { 
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      chain: z.string().optional().default("eth")
    },
    async ({ address, chain }) => {
      try {
        // Use API key from environment variable
        const apiKey = process.env.MORALIS_API_KEY;
        if (!apiKey) {
          throw new Error("MORALIS_API_KEY environment variable is not set");
        }
        
        // Format the URL for PowerShell request
        const url = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/profitability?chain=${chain}`;
        const psCommand = `powershell -Command "Invoke-RestMethod -Method Get -Uri '${url}' -Headers @{'X-API-Key'='${apiKey}'; 'accept'='application/json'} | ConvertTo-Json -Depth 10"`;
        
        // Execute PowerShell command
        const { stdout } = await execPromise(psCommand);
        const response = JSON.parse(stdout);
        
        // Get profit/loss data from the response
        const tokens = response.result || [];
        
        // Process data - calculate some summary statistics
        let totalRealizedProfit = 0;
        let totalInvested = 0;
        let profitableTokens = 0;
        let unprofitableTokens = 0;
        
        tokens.forEach(token => {
          if (token.realized_profit_usd) {
            totalRealizedProfit += parseFloat(token.realized_profit_usd);
          }
          if (token.total_usd_invested) {
            totalInvested += parseFloat(token.total_usd_invested);
          }
          
          if (parseFloat(token.realized_profit_percentage || 0) > 0) {
            profitableTokens++;
          } else if (parseFloat(token.realized_profit_percentage || 0) < 0) {
            unprofitableTokens++;
          }
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `Wallet PnL for ${address} on chain ${chain}:\n` +
                  `Summary: ${tokens.length} tokens analyzed\n` +
                  `Total invested: $${totalInvested.toFixed(2)}\n` +
                  `Total realized profit/loss: $${totalRealizedProfit.toFixed(2)}\n` +
                  `Profitable tokens: ${profitableTokens}, Unprofitable tokens: ${unprofitableTokens}\n\n` +
                  `Detailed results: ${JSON.stringify(tokens, null, 2)}`
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error fetching wallet profitability: ${error.message}`
          }]
        };
      }
    }
  );
} 