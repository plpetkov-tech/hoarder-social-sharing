// Import only from Deno standard library
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// API credentials from environment variables
const HOARDER_API_TOKEN = Deno.env.get("HOARDER_API_TOKEN") || "";
const HOARDER_API_BASE_URL = Deno.env.get("HOARDER_API_BASE_URL") || "";

// Bluesky API credentials
const BLUESKY_USERNAME = Deno.env.get("BLUESKY_USERNAME") || ""; 
const BLUESKY_PASSWORD = Deno.env.get("BLUESKY_PASSWORD") || ""; 
const BLUESKY_API_BASE_URL = "https://bsky.social/xrpc";

// LinkedIn API credentials
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";
const LINKEDIN_USER_URN = Deno.env.get("LINKEDIN_USER_URN") || "";

// Bluesky has a character limit of 300 characters
const BLUESKY_CHAR_LIMIT = 300;

const PORT = parseInt(Deno.env.get("PORT") || "3000");

// Array of engaging phrases to use at the beginning of posts
const ENGAGING_PHRASES = [
  "💡 Interesting read worth hoarding:",
  "📚 Bookmarked this gem for later:",
  "🔖 Just saved this excellent piece:",
  "💎 Found a treasure worth sharing:",
  "🧠 Brain food I've saved for you:",
  "📌 Pinned this must-read article:",
  "⭐ Star content worth your time:",
  "📑 Filed this under 'brilliant reads':",
  "🔍 Discovered this fascinating insight:",
  "💡 Lightbulb moment in this read:",
  "📋 Added to my collection of great finds:",
  "🌟 Stellar content worth remembering:",
  "📖 Page-turner I've saved for reference:",
  "🧩 Insightful piece worth your attention:",
  "🏆 Top-tier content I'm archiving:",
  "📤 Sharing this remarkable article:",
  "💫 Content that deserves a spotlight:",
  "🔆 Bright ideas worth preserving:",
  "📕 Notable read I've archived:",
  "🗃️ Worth keeping in your knowledge base:"
];

// Function to get a random engaging phrase
function getRandomEngagingPhrase() {
  const randomIndex = Math.floor(Math.random() * ENGAGING_PHRASES.length);
  return ENGAGING_PHRASES[randomIndex];
}

// Track bookmarks that are being processed
const processedBookmarks = new Map();

// Function to fetch bookmark data from the API
async function fetchBookmark(bookmarkId) {
  try {
    const response = await fetch(`${HOARDER_API_BASE_URL}/bookmarks/${bookmarkId}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${HOARDER_API_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching bookmark ${bookmarkId}:`, error.message);
    return null;
  }
}

// Function to request AI summarization of a bookmark
async function requestSummarization(bookmarkId) {
  try {
    console.log(`Requesting AI summarization for bookmark ${bookmarkId}`);
    
    const response = await fetch(`${HOARDER_API_BASE_URL}/bookmarks/${bookmarkId}/summarize`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${HOARDER_API_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`Successfully requested summarization for ${bookmarkId}`);
    return result;
  } catch (error) {
    console.error(`Error requesting summarization for ${bookmarkId}:`, error.message);
    return null;
  }
}

// Function to create a social media post from bookmark data
function createSocialMediaPost(bookmark) {
  // Extract the necessary information
  const title = bookmark.content.title || "";
  const url = bookmark.content.url;
  const summary = bookmark.summary || "No summary available";
  
  // Format tags as hashtags
  const hashtags = bookmark.tags.map(tag => `#${tag.name.replace(/\s+/g, "")}`).join(" ");
  
  // Clean up the summary - remove any markdown or AI-generated text patterns
  let cleanSummary = summary
    .replace(/\*\*Summary:\*\*/gi, "")
    .replace(/Here's a summary of the provided content, adhering to all the specified rules:/gi, "")
    .replace(/\*\*/g, "")
    .trim();
  
  // Get a random engaging phrase
  const randomPhrase = getRandomEngagingPhrase();
  
  // Create the post content
  const post = {
    // The image would be the same as the bookmark's image
    imageUrl: bookmark.content.imageUrl || null,
    // Default text format - will be customized for each platform
    text: `${randomPhrase} ${url}\n\n${cleanSummary}\n\n${hashtags}`,
    // Store original components separately for platform-specific formatting
    components: {
      title,
      url,
      summary: cleanSummary,
      hashtags,
      tags: bookmark.tags,
      engagingPhrase: randomPhrase
    }
  };
  
  return post;
}

// Function to extract links and hashtags from text and convert to Bluesky facets
function createFacetsForLinksAndTags(text) {
  const facets = [];
  
  // Match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let urlMatch;
  
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const url = urlMatch[0];
    facets.push({
      index: {
        byteStart: urlMatch.index,
        byteEnd: urlMatch.index + url.length
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: url
        }
      ]
    });
  }
  
  // Match hashtags
  const hashtagRegex = /#(\w+)/g;
  let tagMatch;
  
  while ((tagMatch = hashtagRegex.exec(text)) !== null) {
    const tag = tagMatch[1]; // Extract just the tag name without the # symbol
    facets.push({
      index: {
        byteStart: tagMatch.index,
        byteEnd: tagMatch.index + tagMatch[0].length
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag: tag
        }
      ]
    });
  }
  
  return facets;
}

// Function to format a post for Bluesky's character limits with proper link formatting
function formatBlueskyPostWithLinks(post) {
  const { title, url, summary, hashtags, engagingPhrase } = post.components;
  
  // Use the randomly selected engaging phrase
  const linkPrefix = engagingPhrase + " ";
  
  // Create a shortened post that fits within Bluesky's character limit
  let shortenedSummary = summary;
  const maxSummaryLength = 170; // Increased for more summary content
  if (shortenedSummary.length > maxSummaryLength) {
    shortenedSummary = shortenedSummary.substring(0, maxSummaryLength - 3) + "...";
  }
  
  // Get hashtags (up to 5 - more visible but not overwhelming)
  const hashtagsArray = hashtags.split(" ");
  const selectedHashtags = hashtagsArray.slice(0, Math.min(5, hashtagsArray.length)).join(" ");
  
  // Format the post with title and url
  let blueskyText = "";
  
  // If there's a title, include it
  if (title) {
    blueskyText = `${linkPrefix}"${title}"\n${url}`;
  } else {
    blueskyText = `${linkPrefix}${url}`;
  }
  
  // Target the FULL character limit
  const targetCharLimit = BLUESKY_CHAR_LIMIT;
  
  // Add summary if there's room
  let remainingChars = targetCharLimit - blueskyText.length;
  if (remainingChars > 4) { // +4 for \n\n
    blueskyText += `\n\n${shortenedSummary.substring(0, Math.min(shortenedSummary.length, remainingChars - 4))}`;
    
    // Add hashtags if there's still room
    remainingChars = targetCharLimit - blueskyText.length;
    if (remainingChars > 2) { // +2 for \n\n
      blueskyText += `\n\n${selectedHashtags.substring(0, Math.min(selectedHashtags.length, remainingChars - 2))}`;
    }
  }
  
  // Final check to ensure we don't exceed the absolute limit
  if (blueskyText.length > BLUESKY_CHAR_LIMIT) {
    blueskyText = blueskyText.substring(0, BLUESKY_CHAR_LIMIT - 3) + "...";
  }
  
  // Create facets for links AND hashtags
  const facets = createFacetsForLinksAndTags(blueskyText);
  
  return { text: blueskyText, facets };
}

// Function to authenticate with Bluesky
async function authenticateWithBluesky() {
  try {
    console.log("Authenticating with Bluesky...");
    
    const response = await fetch(`${BLUESKY_API_BASE_URL}/com.atproto.server.createSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        identifier: BLUESKY_USERNAME,
        password: BLUESKY_PASSWORD
      })
    });
    
    if (!response.ok) {
      throw new Error(`Bluesky API responded with status ${response.status}`);
    }
    
    const session = await response.json();
    console.log("Successfully authenticated with Bluesky");
    return session;
  } catch (error) {
    console.error("Error authenticating with Bluesky:", error.message);
    return null;
  }
}

// Function to post to Bluesky
async function postToBluesky(post) {
  try {
    console.log("Posting to Bluesky...");
    
    // First authenticate
    const session = await authenticateWithBluesky();
    if (!session || !session.accessJwt) {
      throw new Error("Failed to authenticate with Bluesky");
    }
    
    // Format post for Bluesky's character limits
    const { text: blueskyText, facets } = formatBlueskyPostWithLinks(post);
    console.log("Formatted Bluesky post:", blueskyText);
    console.log(`Character count: ${blueskyText.length}/${BLUESKY_CHAR_LIMIT}`);
    
    // Create the post record
    const postRecord = {
      text: blueskyText,
      createdAt: new Date().toISOString(),
      $type: "app.bsky.feed.post"
    };
    
    // Add facets if there are any
    if (facets && facets.length > 0) {
      postRecord.facets = facets;
    }
    
    // Add an image if available
    if (post.imageUrl) {
      // Note: Bluesky requires uploading images separately first and then referencing them
      // This would require additional implementation
      console.log("Image sharing on Bluesky requires additional setup. Posting without image.");
    }
    
    // Now create the post
    const response = await fetch(`${BLUESKY_API_BASE_URL}/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.accessJwt}`
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: postRecord
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bluesky API responded with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Successfully posted to Bluesky:", result);
    return result;
  } catch (error) {
    console.error("Error posting to Bluesky:", error.message);
    return null;
  }
}

// Function to format text for LinkedIn to make it visually appealing
function formatLinkedInText(components) {
  const { title, url, summary, hashtags, engagingPhrase } = components;
  
  // Create an elegant, professional post format
  let formattedText = "";
  
  // Add the randomly selected engaging phrase
  formattedText += `${engagingPhrase}\n\n`;
  
  // Add title with quotes if available
  if (title) {
    formattedText += `"${title}"\n\n`;
  }
  
  // Add the link
  formattedText += `🔗 ${url}\n\n`;
  
  // Add the summary without any markdown artifacts
  formattedText += `${summary}\n\n`;
  
  // Organize hashtags in a clean way
  // Group similar hashtags and limit to a reasonable number (8-10 max)
  const hashtagsArray = hashtags.split(" ");
  const selectedHashtags = hashtagsArray.slice(0, Math.min(10, hashtagsArray.length)).join(" ");
  formattedText += selectedHashtags;
  
  return formattedText;
}

// Function to post to LinkedIn
async function postToLinkedIn(post) {
  try {
    console.log("Posting to LinkedIn...");
    
    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_USER_URN) {
      console.log("LinkedIn credentials not configured. Skipping LinkedIn post.");
      return null;
    }
    
    // Format the post for LinkedIn using simple text formatting
    const formattedText = formatLinkedInText(post.components);
    
    // Create LinkedIn post payload
    const payload = {
      author: `urn:li:person:${LINKEDIN_USER_URN}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: formattedText
          },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };
    
    // If the post has an image, add it to the LinkedIn post
    if (post.imageUrl) {
      // For image posts, you would need to first upload the image to LinkedIn
      // and then reference it in the post
      // This would require additional API calls which are not implemented here
      console.log("Image sharing on LinkedIn requires additional setup. Posting without image.");
    }
    
    // Send the post to LinkedIn
    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        "LinkedIn-Version": "202210",
        "X-Restli-Protocol-Version": "2.0.0"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkedIn API responded with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Successfully posted to LinkedIn:", result);
    return result;
  } catch (error) {
    console.error("Error posting to LinkedIn:", error.message);
    return null;
  }
}

// Function to post to social media platforms
async function postToSocialMedia(post) {
  console.log("POSTING TO SOCIAL MEDIA:");
  console.log(JSON.stringify(post, null, 2));
  
  // Track the results from each platform
  const results = {
    bluesky: null,
    linkedin: null
  };
  
  // Post to Bluesky if configured
  if (BLUESKY_USERNAME && BLUESKY_PASSWORD) {
    results.bluesky = await postToBluesky(post);
  } else {
    console.log("Bluesky posting is not configured");
  }
  
  // Post to LinkedIn if configured
  if (LINKEDIN_ACCESS_TOKEN && LINKEDIN_USER_URN) {
    results.linkedin = await postToLinkedIn(post);
  } else {
    console.log("LinkedIn posting is not configured");
  }
  
  return results;
}

// Create the HTTP handler
async function handler(request) {
  // Only process POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Parse the request body
    const body = await request.json();
    console.log("Received webhook:", body);
    
    const { bookmarkId, operation } = body;
    
    // Process based on operation type
    switch (operation) {
      case "created":
        // Track the bookmark but don't post yet
        processedBookmarks.set(bookmarkId, { status: "created" });
        console.log(`Bookmark ${bookmarkId} created and being tracked`);
        break;
        
      case "crawled":
        // After crawling, check if we need to request summarization
        if (processedBookmarks.has(bookmarkId)) {
          const bookmark = await fetchBookmark(bookmarkId);
          
          if (bookmark) {
            // If no summary exists, request one
            if (!bookmark.summary) {
              await requestSummarization(bookmarkId);
              processedBookmarks.set(bookmarkId, { status: "summarizing" });
              console.log(`Requested summarization for ${bookmarkId}`);
            } else {
              processedBookmarks.set(bookmarkId, { status: "summarized" });
              console.log(`Bookmark ${bookmarkId} already has a summary`);
            }
          }
        }
        break;
        
      case "ai tagged":
        // When AI tagging is complete, create and post
        if (processedBookmarks.has(bookmarkId)) {
          const bookmark = await fetchBookmark(bookmarkId);
          
          if (bookmark) {
            // If bookmark doesn't have a summary yet, request one
            if (!bookmark.summary) {
              console.log(`Bookmark ${bookmarkId} is tagged but has no summary, requesting one`);
              const updatedBookmark = await requestSummarization(bookmarkId);
              
              if (updatedBookmark && updatedBookmark.summary) {
                // Create and post with the updated bookmark that has a summary
                const post = createSocialMediaPost(updatedBookmark);
                await postToSocialMedia(post);
              } else {
                // Post with the original bookmark if summarization fails
                const post = createSocialMediaPost(bookmark);
                await postToSocialMedia(post);
              }
            } else {
              // Create and post with the existing summary
              const post = createSocialMediaPost(bookmark);
              await postToSocialMedia(post);
            }
            
            // Remove from tracking after posting
            processedBookmarks.delete(bookmarkId);
          }
        }
        break;
        
      default:
        console.log(`Ignoring unhandled operation: ${operation}`);
    }
    
    // Respond to the webhook
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Start the server
console.log(`Webhook server running on port ${PORT}`);
await serve(handler, { port: PORT });
