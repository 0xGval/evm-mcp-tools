import { z } from "zod";
import axios from "axios";

// RapidAPI configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "twitter154.p.rapidapi.com";

/**
 * Registers Twitter search tools with the MCP server
 * @param {McpServer} server - The MCP server instance
 */
export function registerTwitterTools(server) {
  // Create a reusable search function
  const performTwitterSearch = async (query, section, limit, min_retweets, min_likes, min_replies, start_date, end_date, language) => {
    // Check for API key
    if (!RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY environment variable is not set");
    }
    
    // Build the query parameters
    const params = new URLSearchParams({
      query: query,
      section: section,
      limit: limit.toString()
    });
    
    // Add optional parameters if provided
    if (min_retweets) params.append('min_retweets', min_retweets.toString());
    if (min_likes) params.append('min_likes', min_likes.toString());
    if (min_replies) params.append('min_replies', min_replies.toString());
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (language) params.append('language', language);
    
    // Make the API request
    const response = await axios({
      method: 'GET',
      url: `https://twitter154.p.rapidapi.com/search/search?${params.toString()}`,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });
    
    // Process the response
    return response.data.results || [];
  };

  // Add Twitter search tool with built-in guide consultation
  server.tool("searchTwitter",
    { 
      query: z.string().min(1, "Search query is required"),
      section: z.enum(["latest", "top"]).optional().default("latest"),
      limit: z.number().int().positive().optional().default(10),
      min_retweets: z.number().int().optional(),
      min_likes: z.number().int().optional(),
      min_replies: z.number().int().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      language: z.string().optional()
    },
    async ({ query, section, limit, min_retweets, min_likes, min_replies, start_date, end_date, language }) => {
      try {
        // ENHANCEMENT: Pre-analyze the query to determine if it needs formatting
        let formattedQuery = query;
        
        // Determine if query appears to be in natural language vs. Twitter syntax
        const isNaturalLanguageQuery = !query.includes('(') && 
                                      !query.includes(':') && 
                                      !query.includes('-') &&
                                      !query.includes('"') &&
                                      !query.startsWith('@');
        
        if (isNaturalLanguageQuery) {
          // This appears to be a natural language query, try to extract intent
          
          // Check for user mentions that should be converted to from: syntax
          if (query.toLowerCase().includes('from user') || query.toLowerCase().includes('by user')) {
            const userMatch = query.match(/from user\s+(\w+)/i) || query.match(/by user\s+(\w+)/i) || 
                            query.match(/from\s+@?(\w+)/i) || query.match(/by\s+@?(\w+)/i);
            
            if (userMatch && userMatch[1]) {
              const username = userMatch[1];
              // Remove the matched part from the query and add proper Twitter syntax
              formattedQuery = query.replace(/from user\s+\w+/i, '')
                                 .replace(/by user\s+\w+/i, '')
                                 .replace(/from\s+@?\w+/i, '')
                                 .replace(/by\s+@?\w+/i, '');
              
              // Add the proper Twitter syntax
              formattedQuery = `(from:${username}) ${formattedQuery.trim()}`;
            }
          }
        } else {
          // Already has some Twitter syntax, just do simple formatting
          
          // Format query if it's not already formatted with parentheses
          if (query.startsWith('@') && !query.includes('(')) {
            formattedQuery = `(from:${query.substring(1)})`;
          }
        }
        
        console.error(`Original query: "${query}"`);
        console.error(`Formatted query: "${formattedQuery}"`);
        
        // Use the shared search function with the formatted query
        const tweets = await performTwitterSearch(
          formattedQuery, section, limit, min_retweets, min_likes, min_replies, start_date, end_date, language
        );
        
        // Format the response
        return {
          content: [{ 
            type: "text", 
            text: formatTwitterResults(formattedQuery, tweets, section)
          }]
        };
      } catch (error) {
        console.error('Error searching Twitter:', error);
        return {
          content: [{ 
            type: "text", 
            text: `Error searching Twitter: ${error.message}`
          }]
        };
      }
    }
  );
  
  // Add a Twitter syntax help tool
  server.tool("twitterSearchHelp",
    { 
      topic: z.string().optional().default("general")
    },
    async ({ topic }) => {
      // Simplified guide content from our resource
      const helpContent = {
        general: `# Twitter Search Syntax Guide

Basic operators:
- Simple keyword: \`ethereum\` - Finds tweets containing this word
- Exact phrase: \`"ethereum scaling"\` - Finds the exact phrase
- OR operator: \`ethereum OR solana\` - Finds tweets with either term
- Exclusion: \`ethereum -solana\` - Finds tweets with ethereum but not solana

Account filters:
- From user: \`(from:username)\` - Tweets sent by a specific account
- To user: \`(to:username)\` - Replies to a specific account
- Mentioning: \`(@username)\` - Tweets that mention this account

Other filters:
- Date range: \`since:2024-01-01 until:2024-01-31\`
- Media: \`has:links\`, \`has:images\`, \`has:videos\`
- Engagement: \`min_faves:100\`, \`min_retweets:50\`, \`min_replies:10\``,

        user: `# User-Related Twitter Search Syntax

- From specific user: \`(from:username)\` - Tweets sent by a specific account
- To specific user: \`(to:username)\` - Replies to a specific account
- Mentioning user: \`(@username)\` - Tweets that mention this account

Examples:
- \`(from:vitalikbuterin) ethereum\` - Tweets from Vitalik about Ethereum
- \`(to:ethereum) help\` - Help requests sent to the Ethereum account`,

        date: `# Date-Related Twitter Search Syntax

- Since date: \`since:YYYY-MM-DD\` - Tweets after this date
- Until date: \`until:YYYY-MM-DD\` - Tweets before this date

Example:
- \`ethereum since:2024-01-01 until:2024-01-31\` - Ethereum tweets from January 2024`
      };

      // Return the requested help topic or general help
      return {
        content: [{
          type: "text",
          text: helpContent[topic] || helpContent.general
        }]
      };
    }
  );
}

/**
 * Format Twitter search results into a readable response
 * @param {string} query - The search query
 * @param {Array} tweets - Array of tweet objects
 * @param {string} section - The section searched (latest or top)
 * @returns {string} Formatted results
 */
function formatTwitterResults(query, tweets, section) {
  if (!tweets || tweets.length === 0) {
    return `No tweets found for query: ${query}`;
  }
  
  let output = [];
  
  output.push(`=== Twitter Search Results ===`);
  output.push(`Query: ${query}`);
  output.push(`Section: ${section}`);
  output.push(`Found ${tweets.length} tweets\n`);
  
  tweets.forEach((tweet, index) => {
    output.push(`[${index + 1}] @${tweet.user.username} (${tweet.user.name})`);
    output.push(`${tweet.text}`);
    output.push(`❤️ ${tweet.favorite_count || 0} | 🔄 ${tweet.retweet_count || 0} | 💬 ${tweet.reply_count || 0}`);
    output.push(`Posted: ${new Date(tweet.creation_date).toLocaleString()}`);
    
    if (tweet.media_url && tweet.media_url.length > 0) {
      output.push(`Media: ${tweet.media_url.join(', ')}`);
    }
    
    output.push(`URL: https://twitter.com/${tweet.user.username}/status/${tweet.tweet_id}`);
    output.push(``);
  });
  
  return output.join('\n');
} 