import React, { useEffect, useRef, useState } from 'react';
import PlaceCard from './PlaceCard';

/**
 * PlacesList component - displays a list of place cards with a combined map
 * @param {Array} places - Array of place objects
 * @param {boolean} compact - Whether to show compact cards
 */
function PlacesList({ places, compact = false }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map when component mounts or places change
  useEffect(() => {
    if (!compact || !mapRef.current) return;

    const placesWithCoords = places.filter(p => p.lat && p.lng);
    if (placesWithCoords.length === 0) return;

    // Load Leaflet CSS and JS dynamically
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        setMapLoaded(true);
        initMap();
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
      initMap();
    }

    function initMap() {
      if (!mapRef.current || !window.L) return;

      // Clean up existing map
      if (mapRef.current._leaflet_id) {
        delete mapRef.current._leaflet_id;
      }
      const container = mapRef.current;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // Calculate bounds
      const lats = placesWithCoords.map(p => p.lat);
      const lngs = placesWithCoords.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Create map
      const map = window.L.map(container).setView([centerLat, centerLng], 13);

      // Add tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Add markers for each place
      placesWithCoords.forEach((place, i) => {
        const marker = window.L.marker([place.lat, place.lng]).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif;">
            <strong>${place.name}</strong><br>
            <small>${place.formatted_address || place.vicinity || ''}</small>
            ${place.rating ? `<br>⭐ ${place.rating}` : ''}
          </div>
        `);

        // Open first marker popup
        if (i === 0) marker.openPopup();
      });

      // Fit bounds to show all markers
      const bounds = placesWithCoords.map(p => [p.lat, p.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      // Cleanup
      if (mapRef.current && mapRef.current._leaflet_id) {
        const container = mapRef.current;
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    };
  }, [compact, places]);

  if (!places || places.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        No places found
      </div>
    );
  }

  const placesWithCoords = places.filter(p => p.lat && p.lng);
  const hasMap = placesWithCoords.length > 0;

  // Calculate bounds for full map link
  let fullMapUrl = '';
  if (hasMap) {
    const lats = placesWithCoords.map(p => p.lat);
    const lngs = placesWithCoords.map(p => p.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    const zoom = maxSpread > 0.5 ? 10 : maxSpread > 0.1 ? 12 : maxSpread > 0.02 ? 14 : 15;
    fullMapUrl = `https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}#map=${zoom}/${centerLat}/${centerLng}`;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {!compact && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Found {places.length} place{places.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Combined map with Leaflet */}
      {compact && hasMap && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '250px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              zIndex: 0,
            }}
          />
          <a
            href={fullMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '0.5rem',
              fontSize: '0.8rem',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Open full map →
          </a>
        </div>
      )}

      {places.map((place, index) => (
        <PlaceCard key={place.place_id || index} place={place} compact={compact} />
      ))}
    </div>
  );
}

export default PlacesList;
