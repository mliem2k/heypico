/**
 * Google Places API integration
 * Handles searching for places and retrieving place details
 */

const MAPS_URL = 'https://maps.googleapis.com/maps/api';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  }
  return `${Math.round(distanceKm)}km`;
}

/**
 * Geocode a location string to coordinates
 * @param {Client} client - Google Maps client
 * @param {string} location - Location string (e.g., "San Francisco, CA")
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function geocodeLocation(client, location) {
  try {
    const response = await client.geocode({
      params: {
        address: location,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
}

/**
 * Reverse geocode coordinates to an address
 * @param {Client} client - Google Maps client
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string|null>} Formatted address or null
 */
export async function reverseGeocode(client, lat, lng) {
  try {
    const response = await client.reverseGeocode({
      params: {
        latlng: { lat, lng },
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].formatted_address;
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return null;
  }
}

/**
 * Search for places using Places API
 * @param {Client} client - Google Maps client
 * @param {Object} options - Search options
 * @param {string} options.query - Search query (e.g., "coffee shop")
 * @param {string} options.location - Location string (e.g., "San Francisco, CA")
 * @param {number} options.radius - Search radius in meters (default: 5000)
 * @param {Object} options.userLocation - User's current location for distance calc {lat, lng}
 * @param {string} options.language - Language code for results (default: en)
 */
export async function searchPlaces(client, {
  query,
  location,
  radius = 5000,
  userLocation = null,
  language = 'en'
}) {
  try {
    let searchParams = {
      query: query,
      key: process.env.GOOGLE_MAPS_API_KEY,
      language: language,
    };

    // If location is provided as coordinates, use location bias
    if (location && location.lat && location.lng) {
      searchParams.location = { lat: location.lat, lng: location.lng };
      searchParams.radius = radius;
    } else if (location && typeof location === 'string') {
      // If location is a string, include it in the query
      searchParams.query = `${query} in ${location}`;
    }

    const response = await client.textSearch({
      params: searchParams,
    });

    if (!response.data.results) {
      return { results: [] };
    }

    // Transform results into a comprehensive format
    const results = response.data.results.slice(0, 20).map(place => {
      const lat = place.geometry?.location?.lat;
      const lng = place.geometry?.location?.lng;
      let distance = null;

      // Calculate distance if user location is provided
      if (userLocation && userLocation.lat && userLocation.lng && lat && lng) {
        distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
      }

      return {
        place_id: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        vicinity: place.vicinity,
        lat: lat,
        lng: lng,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        price_level: place.price_level,
        // Comprehensive place data
        phone: place.international_phone_number,
        website: place.website,
        opening_hours: place.opening_hours ? {
          open_now: place.opening_hours.open_now,
          periods: place.opening_hours.periods,
          weekday_text: place.opening_hours.weekday_text,
        } : null,
        types: place.types,
        photos: place.photos?.slice(0, 3).map(photo => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height,
        })) || [],
        distance_km: distance,
        distance_text: distance !== null ? formatDistance(distance) : null,
        permanently_closed: place.permanently_closed,
      };
    });

    return {
      results,
      search_center: userLocation || null,
    };
  } catch (error) {
    // Handle API errors gracefully
    if (error.response?.status === 403) {
      return { results: [], error: 'Google Maps API key issue - check enabled APIs' };
    }
    throw error;
  }
}

/**
 * Get detailed information about a specific place
 * @param {Client} client - Google Maps client
 * @param {string} placeId - The place ID to look up
 * @param {Object} userLocation - User's current location for distance calc {lat, lng}
 */
export async function getPlaceDetails(client, placeId, userLocation = null) {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'formatted_phone_number',
          'international_phone_number',
          'website',
          'url',
          'rating',
          'user_ratings_total',
          'price_level',
          'opening_hours',
          'geometry',
          'types',
          'photos',
          'reviews',
          'adr_address',
          'business_status',
          'curbside_pickup',
          'delivery',
          'dine_in',
          'editorial_summary',
          'reservable',
          'serves_beer',
          'serves_breakfast',
          'serves_brunch',
          'serves_dinner',
          'serves_lunch',
          'serves_vegetarian_food',
          'serves_wine',
          'takeout',
          'wheelchair_accessible_entrance',
        ],
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const place = response.data.result;
    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;
    let distance = null;

    // Calculate distance if user location is provided
    if (userLocation && userLocation.lat && userLocation.lng && lat && lng) {
      distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
    }

    return {
      result: {
        place_id: place.place_id || placeId,
        name: place.name,
        formatted_address: place.formatted_address,
        phone: place.formatted_phone_number,
        international_phone_number: place.international_phone_number,
        website: place.website,
        google_maps_url: place.url,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        price_level: place.price_level,
        opening_hours: place.opening_hours ? {
          open_now: place.opening_hours.open_now,
          periods: place.opening_hours.periods,
          weekday_text: place.opening_hours.weekday_text,
        } : null,
        location: {
          lat: lat,
          lng: lng,
        },
        types: place.types,
        photos: place.photos?.slice(0, 10).map(photo => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height,
        })) || [],
        reviews: place.reviews?.map(review => ({
          author_name: review.author_name,
          rating: review.rating,
          text: review.text,
          time: review.time,
          relative_time_description: review.relative_time_description,
        })) || [],
        business_status: place.business_status,
        permanently_closed: place.permanently_closed,
        editorial_summary: place.editorial_summary?.overview || null,
        // Service options
        curbside_pickup: place.curbside_pickup,
        delivery: place.delivery,
        dine_in: place.dine_in,
        reservable: place.reservable,
        takeout: place.takeout,
        // Accessibility
        wheelchair_accessible_entrance: place.wheelchair_accessible_entrance,
        // Serves options
        serves_beer: place.serves_beer,
        serves_breakfast: place.serves_breakfast,
        serves_brunch: place.serves_brunch,
        serves_dinner: place.serves_dinner,
        serves_lunch: place.serves_lunch,
        serves_vegetarian_food: place.serves_vegetarian_food,
        serves_wine: place.serves_wine,
        // Distance info
        distance_km: distance,
        distance_text: distance !== null ? formatDistance(distance) : null,
      },
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Place not found');
    }
    if (error.response?.status === 403) {
      return { result: null, error: 'API key issue' };
    }
    throw error;
  }
}
