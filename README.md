# Ethereum Tools for Claude MCP

A comprehensive toolkit for Ethereum blockchain analysis directly within Claude AI using Model Context Protocol (MCP).

## Features

- **Smart Contract Audit**: Analyze contracts for security issues, verify source code, and detect token standards
- **Wallet Analysis**: Check ETH balances, token holdings, and transaction history
- **Profitability Tracking**: Calculate wallet profit/loss across tokens and trades
- **Blockchain Data**: Fetch and analyze on-chain data with simple commands
- **Token Analysis**: Get comprehensive token details, price history, and trading patterns
- **Twitter Search**: Find tweets by keywords, usernames, dates, or complex search criteria with natural language processing

## Installation

### Prerequisites
- Node.js v16+
- Claude for Desktop
- Free API keys:
  - [Etherscan](https://etherscan.io/apis) - For contract verification and analysis
  - [Moralis](https://moralis.io/) - For wallet profitability and token balances
  - [Codex](https://codex.io/) - For token price history and advanced analytics
  - [RapidAPI](https://rapidapi.com/omarmhaimdat/api/twitter154) - For Twitter search functionality
  - (Optional) RPC provider like [Infura](https://infura.io/) or use free public endpoints

### Setup Steps

1. Clone this repository:
   ```
   git clone https://github.com/0xGval/evm-tools-mcp
   cd evm-tools-mcp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create your configuration:
   - Copy `mcp.json.example` to `mcp.json`
   - Edit `mcp.json` to include your API keys and correct file paths

   ```json
   {
     "mcpServers": {
       "ethereum-tools": {
         "command": "node",
         "args": ["YOUR_ABSOLUTE_PATH_TO/main.js"],
         "env": {
           "ETH_RPC_URL": "https://eth.llamarpc.com",
           "MORALIS_API_KEY": "your_moralis_api_key",
           "ETHERSCAN_API_KEY": "your_etherscan_api_key",
           "CODEX_API_KEY": "your_codex_api_key",
           "RAPIDAPI_KEY": "your_rapidapi_key"
         }
       }
     }
   }
   ```

4. Configure Claude for Desktop:
   - On Windows: Create/edit `%APPDATA%\Claude\claude_desktop_config.json`
   - Copy the contents of your `mcp.json` file into this configuration

## Available Tools

### Contract Analysis
- `auditContract(address: "0x...")`: Perform security audit on a smart contract

### Balance & Tokens
- `getEthBalance(address: "0x...")`: Get ETH balance
- `getTransactionCount(address: "0x...")`: Get transaction count (nonce)
- `getTokensBalance(address: "0x...", chain: "eth", excludeSpam: true)`: Get all token balances

### Profitability
- `getWalletPnl(address: "0x...", chain: "eth")`: Analyze wallet profit/loss

### Token Analysis
- `getTokenInfo(address: "0x...", networkId: 1)`: Get basic token information including name, symbol, and supply
- `getTokenPriceHistory(address: "0x...", networkId: 1, days: 7, resolution: "1D")`: Get historical price data
- `analyzeToken(address: "0x...", networkId: 1, days: 30)`: Perform comprehensive token analysis including volatility and trading patterns

### Twitter Search
- `searchTwitter(query: "ethereum", section: "top", limit: 5)`: Intelligent Twitter search with natural language processing
  - Automatically formats natural language queries into proper Twitter syntax
  - Understands user queries like "Find tweets by _gval about hyperliquid"
  - Supports advanced Twitter search operators: `from:username`, `has:links`, etc.
  - Optional parameters: min_likes, min_retweets, min_replies, start_date, end_date, language

- `twitterSearchHelp(topic: "general")`: Get help with Twitter search syntax 
  - Available topics: "general", "user", "date"
  - Provides examples and explanations of Twitter search operators

### Utilities
- `add(a: 1, b: 2)`: Simple utility function example

## Troubleshooting

Common issues:
- **Environment variables not found**: Make sure your API keys are correctly set in `mcp.json`
- **Provider errors**: Check that your ETH_RPC_URL is valid and accessible
- **Path errors**: Ensure you're using full absolute paths with proper escaping in Windows (`\\`)
- **Codex API issues**: Verify your Codex API key is valid and has permission to access token data
- **Twitter search errors**: Make sure your RapidAPI key has access to the Twitter154 API

## Development

To add new tools:
1. Create or modify files in the `tools/` directory
2. Register your tools in `main.js`
3. Restart Claude for Desktop to see changes

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Model Context Protocol (MCP)](https://docs.anthropic.com/claude/docs/claude-for-desktop-model-context-protocol) by Anthropic
- [Web3.js](https://web3js.org/)
- [Moralis](https://moralis.io/)
- [Etherscan](https://etherscan.io/)
- [Codex](https://codex.io/)
- [RapidAPI Twitter154](https://rapidapi.com/omarmhaimdat/api/twitter154)

