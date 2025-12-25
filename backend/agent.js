import "dotenv/config";
import { Client } from "@googlemaps/google-maps-services-js";
import { searchPlaces } from "./maps/places.js";

const googleClient = new Client({});

// Ollama configuration - using native API endpoint
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

// System prompt for JSON extraction (like llm-map)
const EXTRACTION_PROMPT = `Extract location search information from user queries. Return ONLY a valid JSON object with these exact fields:

{
  "query": "what the user is looking for (e.g., 'coffee shop', 'restaurant', 'hospital')",
  "location": "where to search (e.g., 'Taipei 101', 'downtown', 'near me')",
  "formatted_query": "query + ' in ' + location for Google Places API (or just query if location is 'near me')"
}

Examples:
User: "find a coffee shop near Taipei 101"
Response: {"query": "coffee shop", "location": "Taipei 101", "formatted_query": "coffee shop in Taipei 101"}

User: "good beef noodles around here"
Response: {"query": "beef noodles", "location": "near me", "formatted_query": "beef noodles"}

User: "gas stations nearby"
Response: {"query": "gas station", "location": "near me", "formatted_query": "gas station"}

User: "restaurants in San Francisco"
Response: {"query": "restaurant", "location": "San Francisco", "formatted_query": "restaurant in San Francisco"}

Return ONLY the JSON object, no other text.`;

/**
 * Extract location intent from user query using LLM with JSON output
 */
async function extractLocationIntent(userQuery) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: userQuery }
        ],
        stream: false,
        format: "json",
        options: { num_predict: 50 } // Limit output length
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.message?.content;

    if (!content) {
      throw new Error("Empty response from LLM");
    }

    // Parse JSON response
    const extracted = JSON.parse(content);

    // Validate required fields
    if (!extracted.query) {
      extracted.query = userQuery;
    }
    if (!extracted.formatted_query) {
      extracted.formatted_query = extracted.query;
    }

    console.log(`[LLM] Extracted:`, extracted);
    return extracted;

  } catch (error) {
    console.error(`[LLM] Extraction error:`, error.message);

    // Fallback: treat entire query as the search
    return {
      query: userQuery,
      location: "near me",
      formatted_query: userQuery
    };
  }
}

// System prompt for generating final response
const CHAT_PROMPT = `You are a helpful assistant for finding places. Format your response as a markdown list with bullet points. Keep responses brief and helpful.`;

/**
 * Stream LLM response with timeout
 */
async function streamLLMResponse(userQuery, places, onChunk) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Build context from search results
    let context = "";
    if (places && places.length > 0) {
      context = `\n\nFound ${places.length} place${places.length > 1 ? 's' : ''}:\n`;
      places.slice(0, 5).forEach((p, i) => {
        context += `${i + 1}. ${p.name} - ${p.rating || "N/A"}★${p.distance_text ? ` (${p.distance_text} away)` : ""}\n`;
      });
    } else {
      context = "\n\nNo places found.";
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: CHAT_PROMPT },
          { role: "user", content: userQuery + context }
        ],
        stream: true,
        options: { num_predict: 150, temperature: 0.7 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            onChunk(parsed.message.content);
          }
        } catch {}
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('[LLM] Response timeout, using fallback');
      throw error;
    }
    throw error;
  }
}

/**
 * Stream chat with places search
 */
export async function streamChatWithTools(messages, onChunk, onError, userLocation = null) {
  const startTime = Date.now();

  try {
    console.log(`[${new Date().toISOString()}] Chat request - model: ${OLLAMA_MODEL}`);

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (!lastUserMessage) {
      onError("No user message found");
      return;
    }

    const userQuery = lastUserMessage.content;
    console.log(`[${new Date().toISOString()}] User query: "${userQuery}"`);

    // Step 1: Extract search intent using LLM (with timeout)
    const extracted = await Promise.race([
      extractLocationIntent(userQuery),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LLM timeout")), 3000)
      )
    ]).catch(err => {
      console.warn(`[LLM] Using fallback: ${err.message}`);
      return { query: userQuery, formatted_query: userQuery };
    });

    // Step 2: Search Google Places
    console.log(`[${new Date().toISOString()}] Searching: "${extracted.formatted_query}"`);
    const placesResult = await searchPlaces(googleClient, {
      query: extracted.formatted_query,
      userLocation: userLocation
    });

    if (placesResult.error) {
      onError(placesResult.error);
      return;
    }

    const places = placesResult.results || [];
    console.log(`[${new Date().toISOString()}] Found ${places.length} places`);

    // Step 3: Send places data to frontend
    if (places.length > 0) {
      onChunk(JSON.stringify({ type: "places", data: places }));
    }

    // Step 4: Generate LLM response
    try {
      await streamLLMResponse(userQuery, places, onChunk);
    } catch (llmError) {
      console.warn(`[LLM] Response generation failed: ${llmError.message}`);
    }

    // Always send completion signal
    onChunk(""); // Signal end of stream
    console.log(`[${new Date().toISOString()}] Total: ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    onError(error.message);
    throw error;
  }
}
