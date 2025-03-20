// Ethereum Contract Analyzer Tool for MCP Server
import { z } from 'zod';
import axios from 'axios';
import { Web3 } from 'web3';

// Use Etherscan API key from environment variables
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
console.error('Etherscan API key set:', !!ETHERSCAN_API_KEY);

// Register for global error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

/**
 * Registers the contract audit tool with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerAuditTool(server) {
  console.error('Registering audit tool...');
  server.tool("auditContract",
    { 
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      chain: z.string().optional().default("eth")
    },
    async ({ address, chain }) => {
      try {
        // Use the web3 instance from the environment variable or default public node
        console.error('Creating Web3 instance with URL:', process.env.ETH_RPC_URL);
        const web3 = new Web3(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com');
        
        // Perform the contract analysis
        console.error('Analyzing address:', address);
        const result = await analyzeAddress(web3, address);
        
        // Format the output for MCP response
        return {
          content: [{ 
            type: "text", 
            text: formatAnalysisResults(result)
          }]
        };
      } catch (error) {
        console.error('Error in auditContract:', error);
        return {
          content: [{ 
            type: "text", 
            text: `Error analyzing contract: ${error.message}`
          }]
        };
      }
    }
  );
  console.error('Audit tool registered successfully');
}

/**
 * Analyze an Ethereum address
 * @param {Web3} web3 - Web3 instance
 * @param {string} address - Ethereum address to analyze
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeAddress(web3, address) {
  try {
    // Validate address
    if (!web3.utils.isAddress(address)) {
      throw new Error('Invalid Ethereum address format');
    }

    // Clean and format the address
    const formattedAddress = web3.utils.toChecksumAddress(address);
    
    // Step 1: Check if address is a contract
    const isContract = await checkIfContract(web3, formattedAddress);
    
    let result = {
      address: formattedAddress,
      isContract: isContract,
      isVerified: false,
      contractName: null,
      contractCreator: null,
      creationTx: null,
      creationTimestamp: null,
      contractCode: null,
      sourceCode: null,
      abi: null,
      error: null
    };

    // If not a contract, return early
    if (!isContract) {
      result.error = 'Address is not a contract';
      
      // Check ETH balance
      const balance = await web3.eth.getBalance(formattedAddress);
      result.ethBalance = web3.utils.fromWei(balance, 'ether');
      
      // Check transaction count
      const txCount = await web3.eth.getTransactionCount(formattedAddress);
      result.transactionCount = txCount;
      
      return result;
    }
    
    // Get creation info
    const creationInfo = await getContractCreationInfo(formattedAddress);
    if (creationInfo) {
      result.contractCreator = creationInfo.contractCreator;
      result.creationTx = creationInfo.txHash;
      result.creationTimestamp = creationInfo.timestamp;
    }
    
    // Step 2: Check if contract is verified on Etherscan
    const verificationInfo = await checkIfVerified(formattedAddress);
    result.isVerified = verificationInfo.isVerified;
    
    // Get bytecode regardless of verification status
    const bytecode = await web3.eth.getCode(formattedAddress);
    result.contractCode = bytecode;
    
    // Step 3: If verified, get contract code and ABI
    if (verificationInfo.isVerified) {
      result.sourceCode = verificationInfo.sourceCode;
      result.contractName = verificationInfo.contractName;
      result.abi = verificationInfo.abi;

      // Check contract interfaces/standards (ERC20, ERC721, etc.)
      result.standards = await detectContractStandards(formattedAddress, verificationInfo.abi);
    } else {
      result.error = 'Contract is not verified on Etherscan';
      
      // Attempt to detect contract type from bytecode
      result.probableType = await detectContractTypeFromBytecode(bytecode);
    }
    
    // Add security analysis if verified (basic heuristics)
    if (verificationInfo.isVerified && verificationInfo.sourceCode) {
      result.securityAnalysis = analyzeContractSecurity(verificationInfo.sourceCode);
    }
    
    return result;
    
  } catch (error) {
    console.error('Error analyzing address:', error);
    return {
      address: address,
      isContract: false,
      isVerified: false,
      contractCode: null,
      sourceCode: null,
      error: error.message
    };
  }
}

/**
 * Check if an address is a contract
 * @param {Web3} web3 - Web3 instance
 * @param {string} address - Ethereum address to check
 * @returns {Promise<boolean>} True if address is a contract
 */
async function checkIfContract(web3, address) {
  try {
    console.error('Checking if address is a contract:', address);
    const code = await web3.eth.getCode(address);
    // If the code is just "0x" or empty, it's not a contract
    return code !== '0x' && code !== '0x0';
  } catch (error) {
    console.error('Error checking if contract:', error);
    return false;
  }
}

/**
 * Get contract creation information from Etherscan
 * @param {string} address - Contract address
 * @returns {Promise<Object>} Creation information
 */
async function getContractCreationInfo(address) {
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await axios.get(url);
    
    const data = response.data;
    if (data.status !== '1' || !data.result || !data.result[0]) {
      return null;
    }
    
    // Get creation transaction info to get the timestamp
    const txHash = data.result[0].txHash;
    let timestamp = null;
    
    try {
      const txUrl = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
      const txResponse = await axios.get(txUrl);
      
      if (txResponse.data.result && txResponse.data.result.blockNumber) {
        const blockNumber = parseInt(txResponse.data.result.blockNumber, 16);
        const blockUrl = `https://api.etherscan.io/api?module=block&action=getblockreward&blockno=${blockNumber}&apikey=${ETHERSCAN_API_KEY}`;
        const blockResponse = await axios.get(blockUrl);
        
        if (blockResponse.data.status === '1' && blockResponse.data.result) {
          timestamp = blockResponse.data.result.timeStamp;
        }
      }
    } catch (error) {
      console.error('Error getting transaction timestamp:', error);
    }
    
    return {
      contractCreator: data.result[0].contractCreator,
      txHash: txHash,
      timestamp: timestamp
    };
  } catch (error) {
    console.error('Error getting contract creation info:', error);
    return null;
  }
}

/**
 * Check if a contract is verified on Etherscan
 * @param {string} address - Contract address to check
 * @returns {Promise<Object>} Verification information
 */
async function checkIfVerified(address) {
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await axios.get(url);
    
    const data = response.data;
    if (data.status !== '1' || !data.result || !data.result[0]) {
      return { isVerified: false };
    }
    
    const contractData = data.result[0];
    // If SourceCode is empty or just a "{}", the contract is not verified
    const isVerified = contractData.SourceCode && contractData.SourceCode !== '{}' && contractData.SourceCode.length > 2;
    
    return {
      isVerified: isVerified,
      contractName: contractData.ContractName,
      sourceCode: contractData.SourceCode,
      abi: isVerified ? JSON.parse(contractData.ABI) : null
    };
  } catch (error) {
    console.error('Error checking verification status:', error);
    return { isVerified: false };
  }
}

/**
 * Detect contract standards (ERC20, ERC721, etc.)
 * @param {string} address - Contract address
 * @param {Array} abi - Contract ABI
 * @returns {Promise<Object>} Detected standards
 */
async function detectContractStandards(address, abi) {
  if (!abi || !Array.isArray(abi)) {
    return {
      isERC20: false,
      isERC721: false,
      isERC1155: false
    };
  }
  
  // Function signatures for different standards
  const erc20Functions = ['totalSupply', 'balanceOf', 'transfer', 'transferFrom', 'approve', 'allowance'];
  const erc721Functions = ['balanceOf', 'ownerOf', 'safeTransferFrom', 'transferFrom', 'approve', 'getApproved', 'setApprovalForAll', 'isApprovedForAll'];
  const erc1155Functions = ['balanceOf', 'balanceOfBatch', 'setApprovalForAll', 'isApprovedForAll', 'safeTransferFrom', 'safeBatchTransferFrom'];
  
  // Extract function names from ABI
  const functionNames = abi
    .filter(item => item.type === 'function')
    .map(func => func.name);
  
  // Check standard compliance by matching function signatures
  const isERC20 = erc20Functions.every(func => functionNames.includes(func));
  const isERC721 = erc721Functions.every(func => functionNames.includes(func));
  const isERC1155 = erc1155Functions.every(func => functionNames.includes(func));
  
  return {
    isERC20,
    isERC721,
    isERC1155
  };
}

/**
 * Attempt to detect contract type from bytecode
 * @param {string} bytecode - Contract bytecode
 * @returns {Promise<string>} Probable contract type
 */
async function detectContractTypeFromBytecode(bytecode) {
  // This is a simple heuristic approach, more advanced detection would require deeper analysis
  
  // Look for common bytecode patterns
  if (bytecode.includes('06fdde03') && bytecode.includes('95d89b41') && bytecode.includes('18160ddd')) {
    return 'Likely Token (ERC20/ERC721)';
  }
  
  if (bytecode.includes('01ffc9a7')) {
    return 'Supports ERC165 Interface Detection';
  }
  
  if (bytecode.includes('e8a3d485')) {
    return 'Possible Uniswap-related contract';
  }
  
  if (bytecode.includes('6080604052')) {
    return 'Solidity 0.4.x+ Contract';
  }
  
  return 'Unknown Contract Type';
}

/**
 * Basic security analysis of contract source code
 * @param {string} sourceCode - Contract source code
 * @returns {Object} Security issues found
 */
function analyzeContractSecurity(sourceCode) {
  const issues = [];
  
  // Check for reentrancy vulnerabilities
  if (sourceCode.includes('call.value') && !sourceCode.includes('ReentrancyGuard')) {
    issues.push({
      severity: 'High',
      issue: 'Potential reentrancy vulnerability',
      description: 'Contract uses call.value without ReentrancyGuard or checks-effects-interactions pattern'
    });
  }
  
  // Check for tx.origin usage
  if (sourceCode.includes('tx.origin')) {
    issues.push({
      severity: 'Medium',
      issue: 'tx.origin used for authentication',
      description: 'Using tx.origin for authentication can be exploited by phishing attacks'
    });
  }
  
  // Check for unchecked external calls
  if ((sourceCode.includes('.call(') || sourceCode.includes('.delegatecall(')) && 
      !sourceCode.match(/require\s*\(\s*.*\.call\s*\(/g)) {
    issues.push({
      severity: 'Medium',
      issue: 'Unchecked external call',
      description: 'External calls without checking return value can lead to silent failures'
    });
  }
  
  // Check for use of block.timestamp
  if (sourceCode.includes('block.timestamp') || sourceCode.includes('now')) {
    issues.push({
      severity: 'Low',
      issue: 'Timestamp dependence',
      description: 'Using block.timestamp for critical logic can be manipulated by miners'
    });
  }
  
  // Check for self-destruct without access control
  if (sourceCode.includes('selfdestruct') || sourceCode.includes('suicide')) {
    issues.push({
      severity: 'High',
      issue: 'Unprotected self-destruct',
      description: 'Self-destruct functionality found - ensure it has proper access controls'
    });
  }
  
  return {
    issuesFound: issues.length > 0,
    issues: issues
  };
}

/**
 * Extract function signatures from contract ABI
 * @param {Array} abi - Contract ABI
 * @returns {Array} Function signatures
 */
function extractFunctionSignatures(abi) {
  if (!abi) return [];
  
  return abi
    .filter(item => item.type === 'function')
    .map(func => {
      const inputs = func.inputs?.map(input => `${input.type} ${input.name || ''}`).join(', ') || '';
      const outputs = func.outputs?.map(output => `${output.type} ${output.name || ''}`).join(', ') || '';
      const stateMutability = func.stateMutability ? `${func.stateMutability}` : '';
      
      return {
        name: func.name,
        signature: `${func.name}(${inputs})`,
        returns: outputs ? `returns (${outputs})` : '',
        stateMutability,
        visibility: func.visibility || 'public',
        fullSignature: `function ${func.name}(${inputs}) ${func.visibility || 'public'} ${stateMutability} ${outputs ? `returns (${outputs})` : ''}`
      };
    });
}

/**
 * Extract event signatures from contract ABI
 * @param {Array} abi - Contract ABI
 * @returns {Array} Event signatures
 */
function extractEventSignatures(abi) {
  if (!abi) return [];
  
  return abi
    .filter(item => item.type === 'event')
    .map(event => {
      const params = event.inputs?.map(input => {
        return `${input.type} ${input.indexed ? 'indexed' : ''} ${input.name || ''}`;
      }).join(', ') || '';
      
      return {
        name: event.name,
        signature: `${event.name}(${params})`,
        fullSignature: `event ${event.name}(${params})`
      };
    });
}

/**
 * Format analysis results into a user-friendly string
 * @param {Object} result - Analysis results
 * @returns {string} Formatted results
 */
function formatAnalysisResults(result) {
  let output = [];
  
  output.push('=== 📊 CONTRACT ANALYSIS RESULTS ===');
  output.push(`📍 Address: ${result.address}`);
  output.push(`📜 Is Contract: ${result.isContract ? '✅ Yes' : '❌ No'}`);
  
  if (!result.isContract) {
    output.push(`💰 ETH Balance: ${result.ethBalance} ETH`);
    output.push(`🔄 Transaction Count: ${result.transactionCount}`);
    return output.join('\n');
  }
  
  output.push(`🔐 Is Verified: ${result.isVerified ? '✅ Yes' : '❌ No'}`);
  
  if (result.contractCreator) {
    output.push(`👤 Contract Creator: ${result.contractCreator}`);
    output.push(`🧾 Creation Tx: ${result.creationTx}`);
    output.push(`⏰ Creation Time: ${new Date(result.creationTimestamp * 1000).toLocaleString()}`);
  }
  
  if (result.isVerified) {
    output.push(`📋 Contract Name: ${result.contractName || 'Unknown'}`);
    
    if (result.standards) {
      output.push('\n📑 CONTRACT STANDARDS:');
      output.push(`   ERC20: ${result.standards.isERC20 ? '✅ Yes' : '❌ No'}`);
      output.push(`   ERC721 (NFT): ${result.standards.isERC721 ? '✅ Yes' : '❌ No'}`);
      output.push(`   ERC1155 (Multi Token): ${result.standards.isERC1155 ? '✅ Yes' : '❌ No'}`);
    }
    
    if (result.abi) {
      const functions = extractFunctionSignatures(result.abi);
      const events = extractEventSignatures(result.abi);
      
      output.push(`\n📝 FUNCTIONS (${functions.length}):`);
      functions.slice(0, 5).forEach(func => {
        output.push(`   - ${func.name}(${func.stateMutability})`);
      });
      
      if (functions.length > 5) {
        output.push(`   ... and ${functions.length - 5} more functions`);
      }
      
      output.push(`\n🔔 EVENTS (${events.length}):`);
      events.slice(0, 5).forEach(event => {
        output.push(`   - ${event.name}`);
      });
      
      if (events.length > 5) {
        output.push(`   ... and ${events.length - 5} more events`);
      }
    }
    
    if (result.securityAnalysis && result.securityAnalysis.issuesFound) {
      output.push('\n⚠️ SECURITY ISSUES:');
      result.securityAnalysis.issues.forEach(issue => {
        output.push(`   [${issue.severity}] ${issue.issue}`);
        output.push(`     ${issue.description}`);
      });
    }
  } else {
    if (result.probableType) {
      output.push(`🔍 Probable Contract Type: ${result.probableType}`);
    }
    output.push('\n❌ Contract is not verified on Etherscan. Limited analysis available.');
  }
  
  if (result.error) {
    output.push(`\n⚠️ Info: ${result.error}`);
  }
  
  return output.join('\n');
}