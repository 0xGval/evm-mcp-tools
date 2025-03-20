import { z } from "zod";
import { exec } from 'child_process';
import { promisify } from 'util';

// Convert exec to promise-based
const execPromise = promisify(exec);

/**
 * Registers token-related tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerTokenTools(server) {
  // Add token balances tool
  server.tool("getTokensBalance",
    { 
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      chain: z.string().optional().default("eth"), 
      excludeSpam: z.boolean().optional().default(true)
    },
    async ({ address, chain, excludeSpam }) => {
      try {
        // Use API key from environment variable
        const apiKey = process.env.MORALIS_API_KEY;
        if (!apiKey) {
          throw new Error("MORALIS_API_KEY environment variable is not set");
        }
        
        // Format the URL for PowerShell request - simpler approach
        const url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=${chain}&exclude_spam=${excludeSpam}`;
        const psCommand = `powershell -Command "Invoke-RestMethod -Method Get -Uri '${url}' -Headers @{'X-API-Key'='${apiKey}'; 'accept'='application/json'} | ConvertTo-Json -Depth 10"`;
        
        // Execute PowerShell command more directly
        const { stdout } = await execPromise(psCommand);
        const response = JSON.parse(stdout);
        const tokens = response.value || response;
        
        // Format just a summary response to avoid large data issues
        const tokenCount = tokens.length;
        const allTokens = tokens.map(token => {
          const decimals = parseInt(token.decimals || '0');
          const rawBalance = token.balance || '0';
          const formattedBalance = decimals > 0 
            ? (parseFloat(rawBalance) / Math.pow(10, decimals)).toFixed(6)
            : rawBalance;
            
          return {
            token_address: token.token_address,
            symbol: token.symbol,
            name: token.name,
            balance_formatted: formattedBalance
          };
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `Found ${tokenCount} tokens for ${address} on chain ${chain}\nAll tokens: ${JSON.stringify(allTokens, null, 2)}`
          }]
        };
      } catch (error) {
        // Simple error response like the working functions
        return {
          content: [{ 
            type: "text", 
            text: `Error fetching token balances: ${error.message}`
          }]
        };
      }
    }
  );
} 