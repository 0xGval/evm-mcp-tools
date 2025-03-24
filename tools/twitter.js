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

  // Add Twitter search tool
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
        // Format query if it's not already formatted with parentheses
        // This helps with common user searches
        if (query.startsWith('@') && !query.includes('(')) {
          query = `(from:${query.substring(1)})`;
        } else if (!query.includes('(') && !query.includes(':')) {
          // This is a simple keyword search, no formatting needed
        }
        
        // Use the shared search function
        const tweets = await performTwitterSearch(
          query, section, limit, min_retweets, min_likes, min_replies, start_date, end_date, language
        );
        
        // Format the response
        return {
          content: [{ 
            type: "text", 
            text: formatTwitterResults(query, tweets, section)
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
  
  // Add user tweets search tool - now uses the shared function directly
  server.tool("getUserTweets",
    { 
      username: z.string().min(1, "Username is required"),
      limit: z.number().int().positive().optional().default(10),
      min_likes: z.number().int().optional(),
      section: z.enum(["latest", "top"]).optional().default("latest")
    },
    async ({ username, limit, min_likes, section }) => {
      try {
        // Format username correctly (remove @ if present)
        const formattedUsername = username.startsWith('@') ? username.substring(1) : username;
        
        // Format the query in the correct format for user tweets
        const query = `(from:${formattedUsername})`;
        
        // Use the shared search function directly
        const tweets = await performTwitterSearch(
          query, section, limit, undefined, min_likes
        );
        
        // Format the response
        return {
          content: [{ 
            type: "text", 
            text: formatTwitterResults(query, tweets, section)
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error fetching tweets from ${username}: ${error.message}`
          }]
        };
      }
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