import { z } from "zod";
import axios from "axios";

// Configuration
const API_URL = 'https://graph.codex.io/graphql';

/**
 * Registers token analysis tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerTokenAnalysisTools(server) {
  // Add token info tool
  server.tool("getTokenInfo",
    { 
      address: z.string().min(1, "Token address is required"),
      networkId: z.number().int().positive().default(1).describe("Network ID (1 for Ethereum, 101 for Solana)")
    },
    async ({ address, networkId }) => {
      try {
        // Get token info from Codex API
        const tokenInfo = await fetchTokenInfo(address, networkId);
        
        if (!tokenInfo) {
          return {
            content: [{ type: "text", text: `No token information found for ${address} on network ${networkId}` }]
          };
        }
        
        // Format the token info for display
        const response = formatTokenInfoResponse(tokenInfo);
        
        return {
          content: [{ type: "text", text: response }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching token info: ${error.message}` }]
        };
      }
    }
  );
  
  // Add token price history tool
  server.tool("getTokenPriceHistory",
    { 
      address: z.string().min(1, "Token address is required"),
      networkId: z.number().int().positive().default(1).describe("Network ID (1 for Ethereum, 101 for Solana)"),
      days: z.number().int().positive().default(7).describe("Number of days of history"),
      resolution: z.string().default("1D").describe("Time resolution (e.g. 1D, 1H, 60)")
    },
    async ({ address, networkId, days, resolution }) => {
      try {
        // Calculate time range
        const to = Math.floor(Date.now() / 1000);
        const from = to - (60 * 60 * 24 * days);
        
        // Get chart data from Codex API
        const chartData = await fetchChartData(address, networkId, resolution, from, to);
        
        if (!chartData || chartData.length === 0) {
          return {
            content: [{ type: "text", text: `No price history found for ${address} on network ${networkId}` }]
          };
        }
        
        // Format the chart data for display
        const response = formatChartDataResponse(chartData);
        
        return {
          content: [{ type: "text", text: response }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching token price history: ${error.message}` }]
        };
      }
    }
  );
  
  // Add advanced token analysis tool
  server.tool("analyzeToken",
    { 
      address: z.string().min(1, "Token address is required"),
      networkId: z.number().int().positive().default(1).describe("Network ID (1 for Ethereum, 101 for Solana)"),
      days: z.number().int().positive().default(30).describe("Number of days to analyze")
    },
    async ({ address, networkId, days }) => {
      try {
        // Get token info
        const tokenInfo = await fetchTokenInfo(address, networkId);
        
        if (!tokenInfo) {
          return {
            content: [{ type: "text", text: `No token information found for ${address} on network ${networkId}` }]
          };
        }
        
        // Calculate time range
        const to = Math.floor(Date.now() / 1000);
        const from = to - (60 * 60 * 24 * days);
        
        // Fetch daily data
        const dailyData = await fetchChartData(address, networkId, "1D", from, to);
        
        // Fetch hourly data (last 7 days only to limit data size)
        const recentFrom = to - (60 * 60 * 24 * Math.min(days, 7));
        const hourlyData = await fetchChartData(address, networkId, "60", recentFrom, to);
        
        // Perform analysis
        const analysis = performTokenAnalysis(tokenInfo, dailyData, hourlyData, days);
        
        return {
          content: [{ type: "text", text: analysis }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error performing token analysis: ${error.message}` }]
        };
      }
    }
  );
}

// Fetch token information from Codex API
async function fetchTokenInfo(address, networkId) {
  try {
    // Use API key from environment variable
    const apiKey = process.env.CODEX_API_KEY;
    if (!apiKey) {
      throw new Error("CODEX_API_KEY environment variable is not set");
    }
    
    const response = await axios({
      url: API_URL,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      data: {
        query: `{
          getTokenInfo(address: "${address}", networkId: ${networkId}) {
            name
            symbol
            totalSupply
            address
            circulatingSupply
          }
        }`
      }
    });
    
    if (response.data && response.data.data && response.data.data.getTokenInfo) {
      return response.data.data.getTokenInfo;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token info:', error.response?.data || error.message);
    throw new Error(`API error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

// Fetch chart data from Codex API
async function fetchChartData(address, networkId, resolution = '1D', from, to) {
  try {
    // Use API key from environment variable
    const apiKey = process.env.CODEX_API_KEY;
    if (!apiKey) {
      throw new Error("CODEX_API_KEY environment variable is not set");
    }
    
    const response = await axios({
      url: API_URL,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      data: {
        query: `{
          getBars(
            symbol: "${address}:${networkId}"
            from: ${from}
            to: ${to}
            resolution: "${resolution}"
            removeEmptyBars: true
          ) {
            t
            o
            h
            l
            c
            v
            volume
            transactions
            buyers
            sellers
            traders
            liquidity
            buyVolume
            sellVolume
            buys
            sells
            volumeNativeToken
          }
        }`
      }
    });
    
    if (response.data && response.data.data && response.data.data.getBars) {
      const bars = response.data.data.getBars;
      
      // Process bars data
      if (Array.isArray(bars.t)) {
        // Multiple bars - restructure into an array of bar objects
        const result = [];
        for (let i = 0; i < bars.t.length; i++) {
          result.push({
            t: bars.t[i],
            o: bars.o[i],
            h: bars.h[i],
            l: bars.l[i],
            c: bars.c[i],
            v: bars.v ? bars.v[i] : null,
            volume: bars.volume ? bars.volume[i] : null,
            transactions: bars.transactions ? bars.transactions[i] : null,
            buyers: bars.buyers ? bars.buyers[i] : null,
            sellers: bars.sellers ? bars.sellers[i] : null,
            traders: bars.traders ? bars.traders[i] : null,
            liquidity: bars.liquidity ? bars.liquidity[i] : null,
            buyVolume: bars.buyVolume ? bars.buyVolume[i] : null,
            sellVolume: bars.sellVolume ? bars.sellVolume[i] : null,
            buys: bars.buys ? bars.buys[i] : null,
            sells: bars.sells ? bars.sells[i] : null,
            volumeNativeToken: bars.volumeNativeToken ? bars.volumeNativeToken[i] : null
          });
        }
        return result;
      } else if (typeof bars.t === 'number') {
        // Single bar
        return [{
          t: bars.t,
          o: bars.o,
          h: bars.h,
          l: bars.l,
          c: bars.c,
          v: bars.v,
          volume: bars.volume,
          transactions: bars.transactions,
          buyers: bars.buyers,
          sellers: bars.sellers,
          traders: bars.traders,
          liquidity: bars.liquidity,
          buyVolume: bars.buyVolume,
          sellVolume: bars.sellVolume,
          buys: bars.buys,
          sells: bars.sells,
          volumeNativeToken: bars.volumeNativeToken
        }];
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching chart data:', error.response?.data || error.message);
    throw new Error(`API error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

// Format token info for display
function formatTokenInfoResponse(info) {
  let response = `=== Token Information ===\n`;
  response += `Name: ${info.name || 'N/A'}\n`;
  response += `Symbol: ${info.symbol || 'N/A'}\n`;
  response += `Address: ${info.address || 'N/A'}\n`;
  response += `Total Supply: ${info.totalSupply || 'N/A'}\n`;
  response += `Circulating Supply: ${info.circulatingSupply || 'N/A'}\n`;
  
  // Calculate additional metrics if possible
  if (info.totalSupply && info.circulatingSupply) {
    const totalSupply = parseFloat(info.totalSupply);
    const circulatingSupply = parseFloat(info.circulatingSupply);
    
    if (!isNaN(totalSupply) && !isNaN(circulatingSupply) && totalSupply > 0) {
      const circulationPercentage = (circulatingSupply / totalSupply) * 100;
      response += `Circulation Percentage: ${circulationPercentage.toFixed(2)}%\n`;
    }
  }
  
  return response;
}

// Format chart data for display
function formatChartDataResponse(data) {
  let response = `=== Price History ===\n`;
  response += `Date       | Open     | High     | Low      | Close    | Volume\n`;
  response += `-----------|----------|----------|----------|----------|------------\n`;
  
  data.forEach(bar => {
    // Make sure all fields are present to avoid errors
    if (bar.t && bar.o !== undefined && bar.h !== undefined && 
        bar.l !== undefined && bar.c !== undefined) {
      response += `${formatDate(bar.t)} | $${bar.o.toFixed(4).padEnd(8)} | $${bar.h.toFixed(4).padEnd(8)} | $${bar.l.toFixed(4).padEnd(8)} | $${bar.c.toFixed(4).padEnd(8)} | $${formatNumber(bar.volume || bar.v)}\n`;
    }
  });
  
  // Display price change
  if (data.length > 1) {
    const firstPrice = data[0].o;
    const lastPrice = data[data.length - 1].c;
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    response += `\nPrice change over period: ${priceChange.toFixed(2)}%\n`;
    
    // Show basic trading activity
    response += '\n=== Recent Trading Activity ===\n';
    const totalTransactions = data.reduce((sum, bar) => sum + (bar.transactions || 0), 0);
    const totalTraders = data.reduce((sum, bar) => sum + (bar.traders || 0), 0);
    
    response += `Total Transactions: ${totalTransactions}\n`;
    response += `Total Unique Traders: ${totalTraders}\n`;
  }
  
  return response;
}

// Perform comprehensive token analysis
function performTokenAnalysis(tokenInfo, dailyData, hourlyData, days) {
  let analysis = formatTokenInfoResponse(tokenInfo);
  
  analysis += `\n=== ANALYZING LAST ${days} DAYS OF DATA ===\n`;
  
  // Add daily chart data with extended stats
  analysis += "\n=== DAILY CHART DATA ===\n";
  analysis += formatChartDataResponse(dailyData);
  
  // Price volatility analysis
  if (dailyData.length > 0) {
    analysis += "\n=== VOLATILITY ANALYSIS ===\n";
    
    // Calculate daily price changes
    const dailyChanges = [];
    for (let i = 1; i < dailyData.length; i++) {
      const prevClose = dailyData[i-1].c;
      const currClose = dailyData[i].c;
      const percentChange = ((currClose - prevClose) / prevClose) * 100;
      dailyChanges.push(percentChange);
    }
    
    // Calculate volatility metrics
    if (dailyChanges.length > 0) {
      const avgChange = dailyChanges.reduce((sum, change) => sum + Math.abs(change), 0) / dailyChanges.length;
      const maxUp = Math.max(...dailyChanges);
      const maxDown = Math.min(...dailyChanges);
      
      analysis += `Average Daily Price Movement: ${avgChange.toFixed(2)}%\n`;
      analysis += `Largest Single-Day Increase: ${maxUp.toFixed(2)}%\n`;
      analysis += `Largest Single-Day Decrease: ${maxDown.toFixed(2)}%\n`;
    }
    
    // Trading pattern analysis using hourly data
    if (hourlyData.length > 0) {
      analysis += "\n=== TRADING PATTERN ANALYSIS ===\n";
      
      // Group trading activity by hour of day to identify patterns
      const hourlyActivity = Array(24).fill(0);
      const hourlyVolume = Array(24).fill(0);
      
      hourlyData.forEach(bar => {
        const date = new Date(bar.t * 1000);
        const hour = date.getUTCHours();
        
        hourlyActivity[hour] += bar.transactions || 0;
        hourlyVolume[hour] += parseFloat(bar.volume || bar.v || 0);
      });
      
      // Find peak trading hours
      let peakHour = 0;
      let peakVolume = 0;
      
      for (let i = 0; i < 24; i++) {
        if (hourlyVolume[i] > peakVolume) {
          peakVolume = hourlyVolume[i];
          peakHour = i;
        }
      }
      
      analysis += `Peak Trading Hour (UTC): ${peakHour}:00 - ${peakHour+1}:00\n`;
      analysis += `Top 3 Active Hours (UTC):\n`;
      
      // Get top 3 active hours
      const hourIndices = Array.from({length: 24}, (_, i) => i);
      hourIndices.sort((a, b) => hourlyVolume[b] - hourlyVolume[a]);
      
      for (let i = 0; i < 3; i++) {
        const hour = hourIndices[i];
        if (hourlyVolume[hour] > 0) {
          analysis += `  ${hour}:00 - ${hour+1}:00: $${formatNumber(hourlyVolume[hour])} volume, ${hourlyActivity[hour]} transactions\n`;
        }
      }
    }
    
    // Volume analysis
    analysis += '\n=== VOLUME ANALYSIS ===\n';
    const totalBuyVolume = dailyData.reduce((sum, bar) => {
      const vol = typeof bar.buyVolume === 'string' ? parseFloat(bar.buyVolume) : (bar.buyVolume || 0);
      return sum + vol;
    }, 0);
    
    const totalSellVolume = dailyData.reduce((sum, bar) => {
      const vol = typeof bar.sellVolume === 'string' ? parseFloat(bar.sellVolume) : (bar.sellVolume || 0);
      return sum + vol;
    }, 0);
    
    analysis += `Buy Volume: $${formatNumber(totalBuyVolume)}\n`;
    analysis += `Sell Volume: $${formatNumber(totalSellVolume)}\n`;
    
    // Calculate volume ratio
    if (totalSellVolume > 0) {
      const volumeRatio = totalBuyVolume / totalSellVolume;
      analysis += `Buy/Sell Volume Ratio: ${volumeRatio.toFixed(2)}\n`;
    }
  }
  
  return analysis;
}

// Format date from Unix timestamp
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

// Format large numbers (e.g., volume)
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return 'N/A';
  
  if (typeof num === 'string') {
    num = parseFloat(num);
  }
  
  if (isNaN(num)) return 'N/A';
  
  // For values over 1 billion
  if (Math.abs(num) >= 1000000000) {
    return (num / 1000000000).toFixed(decimals) + 'B';
  }
  
  // For values over 1 million
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(decimals) + 'M';
  }
  
  // For values over 1 thousand
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(decimals) + 'K';
  }
  
  return num.toFixed(decimals);
} 