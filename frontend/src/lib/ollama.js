// API configuration - proxied through backend
const API_HOST = '/api';
const MODEL = 'phi3:mini'; // Using fast model for quick responses

/**
 * Stream chat from backend (uses JSON extraction + Ollama)
 * @param {Array} messages - Chat history
 * @param {Function} onChunk - Callback for each chunk of text
 * @param {Function} onError - Callback for errors
 * @param {Object} userLocation - User's location for distance calc {lat, lng}
 */
export async function streamChat(messages, onChunk, onError, userLocation = null) {
  try {
    // Format messages - backend handles system prompt
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch(`${API_HOST}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: formattedMessages,
        userLocation: userLocation,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const data = line.slice(6);

        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            onChunk(parsed.content);
          } else if (parsed.type === 'places') {
            // Pass places data as JSON string for App.jsx to parse
            onChunk(data);
          }
          if (parsed.error) {
            onError(parsed.error);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  } catch (error) {
    onError(error.message);
    throw error;
  }
}

/**
 * Search for places
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @param {string} options.location - Location string
 * @param {number} options.radius - Search radius in meters
 * @param {Object} options.userLocation - User's location {lat, lng}
 */
export async function searchPlaces(query, options = {}) {
  const { location, radius = 5000, userLocation } = options;

  const params = new URLSearchParams({ query });
  if (location) params.set('location', location);
  if (radius) params.set('radius', radius);
  if (userLocation?.lat) params.set('userLat', userLocation.lat);
  if (userLocation?.lng) params.set('userLng', userLocation.lng);

  const response = await fetch(`${API_HOST}/places/search?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Get detailed information about a place
 * @param {string} placeId - Google Place ID
 * @param {Object} userLocation - User's location for distance calc
 */
export async function getPlaceDetails(placeId, userLocation = null) {
  const params = new URLSearchParams({ placeId });
  if (userLocation?.lat) params.set('userLat', userLocation.lat);
  if (userLocation?.lng) params.set('userLng', userLocation.lng);

  const response = await fetch(`${API_HOST}/places/details?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 */
export async function geocode(address) {
  const response = await fetch(`${API_HOST}/geocode?address=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Reverse geocode coordinates to an address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
export async function reverseGeocode(lat, lng) {
  const response = await fetch(`${API_HOST}/reverse-geocode?lat=${lat}&lng=${lng}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Calculate distance between two points
 * @param {number} lat1 - First point latitude
 * @param {number} lng1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lng2 - Second point longitude
 */
export async function calculateDistance(lat1, lng1, lat2, lng2) {
  const response = await fetch(
    `${API_HOST}/distance?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}`
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Get list of available models from Ollama directly
 */
export async function getModels() {
  try {
    const response = await fetch('/ollama/api/tags');
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

/**
 * Check if Ollama is running
 */
export async function checkConnection() {
  try {
    const response = await fetch('/ollama/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get user's current location using browser Geolocation API
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[Geolocation] Not supported by this browser');
      resolve(null);
      return;
    }

    console.log('[Geolocation] Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log('[Geolocation] Location found:', location);
        resolve(location);
      },
      (error) => {
        console.warn('[Geolocation] Error:', error.code, error.message);
        if (error.code === 1) {
          console.warn('[Geolocation] Permission denied by user');
        } else if (error.code === 2) {
          console.warn('[Geolocation] Position unavailable');
        } else if (error.code === 3) {
          console.warn('[Geolocation] Timeout');
        }
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  });
}
