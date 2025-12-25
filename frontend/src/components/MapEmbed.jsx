import React, { useState } from 'react';

function MapEmbed({ placeId, query, width = '100%', height = '300px' }) {
  const [imageError, setImageError] = useState(false);

  // Build the Google Maps embed URL
  const embedUrl = placeId
    ? `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d0!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0x0!2zM!3e0!3m2!sen-US!sus!5e0!3m2!sen-US!sus&cid=${placeId}`
    : `https://www.google.com/maps?q=${encodeURIComponent(query || '')}&output=embed&z=13`;

  // Direct link to Google Maps
  const directLink = placeId
    ? `https://www.google.com/maps/place/?cid=${placeId}`
    : `https://www.google.com/maps/search/${encodeURIComponent(query || '')}`;

  return (
    <div
      className="map-embed-container"
      style={{
        marginTop: '1rem',
        marginBottom: '1rem',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--map-border)',
      }}
    >
      <iframe
        width={width}
        height={height}
        style={{ border: 0, display: 'block' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
        title="Map"
      />
      <a
        href={directLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '0.75rem',
          fontSize: '0.875rem',
          color: 'var(--accent)',
          textDecoration: 'none',
          background: 'var(--bg-tertiary)',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border-color)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      >
        Open in Google Maps →
      </a>
    </div>
  );
}

export default MapEmbed;
