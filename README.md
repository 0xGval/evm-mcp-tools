# Ethereum Tools for Claude MCP

A comprehensive toolkit for Ethereum blockchain analysis directly within Claude AI using Model Context Protocol (MCP).

## Features

- **Smart Contract Audit**: Analyze contracts for security issues, verify source code, and detect token standards
- **Wallet Analysis**: Check ETH balances, token holdings, and transaction history
- **Profitability Tracking**: Calculate wallet profit/loss across tokens and trades
- **Blockchain Data**: Fetch and analyze on-chain data with simple commands

## Installation

### Prerequisites
- Node.js v16+
- Claude for Desktop
- Free API keys:
  - [Etherscan](https://etherscan.io/apis) - For contract verification and analysis
  - [Moralis](https://moralis.io/) - For wallet profitability and token balances
  - (Optional) RPC provider like [Infura](https://infura.io/) or use free public endpoints

### Setup Steps

1. Clone this repository:
   ```
   git clone https://github.com/giovannialbero1992/ethereum-tools-mcp
   cd ethereum-tools-mcp
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
           "ETHERSCAN_API_KEY": "your_etherscan_api_key"
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

### Utilities
- `add(a: 1, b: 2)`: Simple utility function example

## Troubleshooting

Common issues:
- **Environment variables not found**: Make sure your API keys are correctly set in `mcp.json`
- **Provider errors**: Check that your ETH_RPC_URL is valid and accessible
- **Path errors**: Ensure you're using full absolute paths with proper escaping in Windows (`\\`)

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

