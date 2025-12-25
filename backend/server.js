import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Client } from '@googlemaps/google-maps-services-js';
import {
  searchPlaces,
  getPlaceDetails,
  geocodeLocation,
  reverseGeocode,
  calculateDistance,
  formatDistance
} from './maps/places.js';
import { getDirections } from './maps/directions.js';
import { streamChatWithTools } from './agent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const googleClient = new Client({});

// Middleware
app.use(express.json());

// CORS configuration - restrict to allowed origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Open WebUI in some cases)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'CORS policy: This origin is not authorized.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware (for usage monitoring)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
  });
});

// Search for places (restaurants, attractions, etc.)
// Query params: query (required), location (optional), radius (optional, meters)
//              userLat, userLng (optional - for distance calculation)
app.get('/api/places/search', async (req, res) => {
  try {
    const { query, location, radius = 5000, userLat, userLng } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Sanitize query
    const sanitizedQuery = query.trim().slice(0, 200);

    const result = await searchPlaces(googleClient, {
      query: sanitizedQuery,
      location,
      radius: parseInt(radius),
      userLocation: (userLat && userLng) ? { lat: parseFloat(userLat), lng: parseFloat(userLng) } : null,
    });

    res.json(result);
  } catch (error) {
    console.error('Places search error:', error.message);
    res.status(500).json({ error: 'Failed to search places', details: error.message });
  }
});

// Get detailed information about a specific place
// Query params: placeId (required), userLat, userLng (optional - for distance calculation)
app.get('/api/places/details', async (req, res) => {
  try {
    const { placeId, userLat, userLng } = req.query;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId parameter is required' });
    }

    const result = await getPlaceDetails(
      googleClient,
      placeId,
      (userLat && userLng) ? { lat: parseFloat(userLat), lng: parseFloat(userLng) } : null
    );
    res.json(result);
  } catch (error) {
    console.error('Place details error:', error.message);
    res.status(500).json({ error: 'Failed to get place details', details: error.message });
  }
});

// Geocode an address to coordinates
// Query params: address (required)
app.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'address parameter is required' });
    }

    const result = await geocodeLocation(googleClient, address);

    if (!result) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ result });
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to geocode address', details: error.message });
  }
});

// Reverse geocode coordinates to an address
// Query params: lat (required), lng (required)
app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters are required' });
    }

    const address = await reverseGeocode(googleClient, parseFloat(lat), parseFloat(lng));

    if (!address) {
      return res.status(404).json({ error: 'Address not found for given coordinates' });
    }

    res.json({ result: { address, lat: parseFloat(lat), lng: parseFloat(lng) } });
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to reverse geocode', details: error.message });
  }
});

// Calculate distance between two points
// Query params: lat1, lng1, lat2, lng2 (all required)
app.get('/api/distance', async (req, res) => {
  try {
    const { lat1, lng1, lat2, lng2 } = req.query;

    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return res.status(400).json({ error: 'lat1, lng1, lat2, and lng2 parameters are required' });
    }

    const distanceKm = calculateDistance(
      parseFloat(lat1),
      parseFloat(lng1),
      parseFloat(lat2),
      parseFloat(lng2)
    );

    res.json({
      result: {
        distance_km: distanceKm,
        distance_text: formatDistance(distanceKm),
        distance_meters: Math.round(distanceKm * 1000),
      }
    });
  } catch (error) {
    console.error('Distance calculation error:', error.message);
    res.status(500).json({ error: 'Failed to calculate distance', details: error.message });
  }
});

// Get directions between two points
// Query params: origin (required), destination (required), mode (optional: driving, walking, bicycling, transit)
app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination, mode = 'driving' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // Validate mode
    const validModes = ['driving', 'walking', 'bicycling', 'transit'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }

    const result = await getDirections(googleClient, {
      origin: origin.trim().slice(0, 500),
      destination: destination.trim().slice(0, 500),
      mode,
    });

    res.json(result);
  } catch (error) {
    console.error('Directions error:', error.message);
    res.status(500).json({ error: 'Failed to get directions', details: error.message });
  }
});

// Generate an embeddable map HTML
// Query params: placeId (required) or q (search query)
app.get('/api/map/embed', (req, res) => {
  try {
    const { placeId, q } = req.query;

    if (!placeId && !q) {
      return res.status(400).json({ error: 'Either placeId or q parameter is required' });
    }

    let embedUrl;
    if (placeId) {
      embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d0!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0x0!2zM!3e0!3m2!sen-US!sus!5e0!3m2!sen-US!sus&cid=${placeId}`;
    } else {
      embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }

    res.json({
      embedUrl,
      html: `<iframe width="600" height="450" style="border:0" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${embedUrl}"></iframe>`,
      directLink: placeId
        ? `https://www.google.com/maps/place/?cid=${placeId}`
        : `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
    });
  } catch (error) {
    console.error('Map embed error:', error.message);
    res.status(500).json({ error: 'Failed to generate map embed', details: error.message });
  }
});

// Chat endpoint with LangChain tools
// POST /api/chat - Chat with LLM that has access to Maps tools
// Body: { messages: [...], userLocation: {lat, lng} }
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userLocation } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    console.log(`[CHAT] Received request with ${messages.length} messages${userLocation ? ' + userLocation' : ''}`);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let chunkCount = 0;
    let buffer = '';

    // Stream response
    await streamChatWithTools(
      messages,
      (chunk) => {
        // Check if this is a JSON object (structured data)
        if (chunk.startsWith('{"type":')) {
          // Send structured data directly
          res.write(`data: ${chunk}\n\n`);
        } else {
          chunkCount++;
          if (chunkCount % 10 === 0) {
            console.log(`[CHAT] Streamed ${chunkCount} chunks`);
          }
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      },
      (error) => {
        console.error(`[CHAT] Error: ${error.message}`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      },
      userLocation || null
    );

    console.log(`[CHAT] Total chunks sent: ${chunkCount}`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed', details: error.message });
    }
  }
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   HeyPico Maps API Server                            ║
╠═══════════════════════════════════════════════════════╣
║   Status: Running                                    ║
║   Port: ${PORT}                                   ║
║   Google Maps: ${process.env.GOOGLE_MAPS_API_KEY ? 'Configured ✓' : 'NOT CONFIGURED ✗'}           ║
╚═══════════════════════════════════════════════════════╝

Endpoints:
  GET /api/health              - Health check
  POST /api/chat               - Chat with LLM + Maps tools
  GET /api/places/search       - Search for places (add userLat/userLng for distance)
  GET /api/places/details      - Get comprehensive place details
  GET /api/directions          - Get directions
  GET /api/map/embed           - Generate embeddable map
  GET /api/geocode             - Convert address to coordinates
  GET /api/reverse-geocode     - Convert coordinates to address
  GET /api/distance            - Calculate distance between two points

Examples:
  # Search with distance calculation
  curl "http://localhost:${PORT}/api/places/search?query=coffee&userLat=25.0320&userLng=121.5654"

  # Geocode an address
  curl "http://localhost:${PORT}/api/geocode?address=Taipei+101"

  # Calculate distance
  curl "http://localhost:${PORT}/api/distance?lat1=25.0320&lng1=121.5654&lat2=25.0340&lng2=121.5674"
  `);
});
