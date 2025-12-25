import React, { useState } from 'react';

/**
 * Render price level as dollar signs
 */
function renderPriceLevel(level) {
  if (!level) return null;
  return '$'.repeat(level);
}

/**
 * Render star rating
 */
function renderStars(rating) {
  if (!rating) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <span style={{ color: '#fbbf24', fontSize: '1rem' }}>★</span>
      <span style={{ fontWeight: 500 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

/**
 * Format open now status
 */
function formatOpenNow(openingHours) {
  if (!openingHours) return null;

  const { open_now } = openingHours;
  if (open_now === undefined) return null;

  return (
    <span
      style={{
        fontSize: '0.75rem',
        padding: '0.125rem 0.5rem',
        borderRadius: '4px',
        background: open_now ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: open_now ? '#22c55e' : '#ef4444',
        fontWeight: 500,
      }}
    >
      {open_now ? 'Open Now' : 'Closed'}
    </span>
  );
}

/**
 * PlaceCard component - displays comprehensive place information
 */
function PlaceCard({ place, compact = false }) {
  const [showDetails, setShowDetails] = useState(false);

  if (compact) {
    return (
      <div
        style={{
          padding: '0.75rem',
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          marginBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{place.name}</h4>
            {place.permanently_closed && (
              <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>Permanently Closed</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {place.vicinity || place.formatted_address}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {place.rating && renderStars(place.rating)}
          {place.distance_text && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {place.distance_text}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '12px',
        background: 'var(--bg-secondary)',
        marginBottom: '1rem',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{place.name}</h3>
            {renderPriceLevel(place.price_level)}
            {place.permanently_closed && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
                Permanently Closed
              </span>
            )}
          </div>

          <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {place.formatted_address || place.vicinity}
          </p>

          {/* Rating and distance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {place.rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {renderStars(place.rating)}
                {place.user_ratings_total && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ({place.user_ratings_total} reviews)
                  </span>
                )}
              </div>
            )}
            {place.distance_text && (
              <span style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 500 }}>
                📍 {place.distance_text} away
              </span>
            )}
            {place.opening_hours && formatOpenNow(place.opening_hours)}
          </div>
        </div>

        {/* Toggle button */}
        {hasExtraDetails(place) && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              flexShrink: 0,
            }}
          >
            {showDetails ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {showDetails && hasExtraDetails(place) && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {place.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>📞</span>
                <a
                  href={`tel:${place.phone}`}
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  {place.phone}
                </a>
              </div>
            )}
            {place.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>🔗</span>
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  Website
                </a>
              </div>
            )}
            {place.google_maps_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>🗺️</span>
                <a
                  href={place.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  Open in Google Maps
                </a>
              </div>
            )}
          </div>

          {/* Opening hours */}
          {place.opening_hours?.weekday_text && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600 }}>Hours</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {place.opening_hours.weekday_text.map((day, i) => (
                  <div key={i} style={{ padding: '0.1rem 0' }}>
                    {day}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service options */}
          {hasServiceOptions(place) && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600 }}>Services</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {place.delivery && <ServiceBadge label="Delivery" />}
                {place.dine_in && <ServiceBadge label="Dine In" />}
                {place.takeout && <ServiceBadge label="Takeout" />}
                {place.curbside_pickup && <ServiceBadge label="Curbside Pickup" />}
                {place.reservable && <ServiceBadge label="Reservable" />}
              </div>
            </div>
          )}

          {/* Accessibility */}
          {place.wheelchair_accessible_entrance !== undefined && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600 }}>Accessibility</h4>
              <span style={{ fontSize: '0.8rem', color: place.wheelchair_accessible_entrance ? '#22c55e' : 'var(--text-secondary)' }}>
                {place.wheelchair_accessible_entrance ? '♿ Wheelchair accessible' : 'No wheelchair access info'}
              </span>
            </div>
          )}

          {/* Types */}
          {place.types && place.types.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600 }}>Categories</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {place.types
                  .filter(t => !t.startsWith('establishment'))
                  .slice(0, 5)
                  .map((type, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '12px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Check if place has extra details to show
 */
function hasExtraDetails(place) {
  return (
    place.phone ||
    place.website ||
    place.opening_hours?.weekday_text ||
    hasServiceOptions(place)
  );
}

/**
 * Check if place has service options
 */
function hasServiceOptions(place) {
  return place.delivery || place.dine_in || place.takeout ||
    place.curbside_pickup || place.reservable;
}

/**
 * Service badge component
 */
function ServiceBadge({ label }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '6px',
        background: 'rgba(59, 130, 246, 0.15)',
        color: '#3b82f6',
      }}
    >
      {label}
    </span>
  );
}

export default PlaceCard;
