/**
 * Google Directions API integration
 * Handles getting directions between two points
 */

/**
 * Get directions between origin and destination
 * @param {Client} client - Google Maps client
 * @param {Object} options - Directions options
 * @param {string} options.origin - Starting location (address or coordinates)
 * @param {string} options.destination - Ending location (address or coordinates)
 * @param {string} options.mode - Travel mode: driving, walking, bicycling, transit
 */
export async function getDirections(client, { origin, destination, mode = 'driving' }) {
  try {
    const response = await client.directions({
      params: {
        origin: origin,
        destination: destination,
        mode: mode,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (!response.data.routes || response.data.routes.length === 0) {
      return { result: null, error: 'No directions found' };
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    return {
      result: {
        routes: [{
          legs: [{
            distance: { text: leg.distance.text },
            duration: { text: leg.duration.text },
          }],
        }],
      },
    };
  } catch (error) {
    if (error.response?.status === 403) {
      return { result: null, error: 'API key issue' };
    }
    return { result: null, error: error.message };
  }
}
