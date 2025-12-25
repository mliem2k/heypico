import React from 'react';
import ReactMarkdown from 'react-markdown';
import MapEmbed from './MapEmbed';
import PlacesList from './PlacesList';

const MAP_TAG_REGEX = /<map\s+(placeId="([^"]+)"|query="([^"]+)")\s*\/>/g;

function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  // Parse message content to extract map tags
  const parseContent = (content) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = MAP_TAG_REGEX.exec(content)) !== null) {
      // Add text before the map tag
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add map component
      parts.push({
        type: 'map',
        placeId: match[2] || undefined,
        query: match[3] || undefined,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    // If no maps found, return entire content as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }

    return parts;
  };

  const parsedParts = parseContent(message.content || '');

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          maxWidth: isUser ? '80%' : '90%',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: isUser
            ? 'var(--user-msg-bg)'
            : 'var(--ai-msg-bg)',
          borderBottomLeftRadius: isUser ? '12px' : '2px',
          borderBottomRightRadius: isUser ? '2px' : '12px',
        }}
      >
        {parsedParts.map((part, i) => {
          if (part.type === 'map') {
            return <MapEmbed key={`map-${i}`} placeId={part.placeId} query={part.query} />;
          }
          return (
            <div key={`text-${i}`} className="markdown-content">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ marginBottom: '0.5rem' }}>{children}</p>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ marginLeft: '1.5rem', marginBottom: '0.5rem' }}>{children}</ol>,
                  code: ({ inline, children }) => (
                    <code
                      style={{
                        background: 'var(--bg-primary)',
                        padding: inline ? '0.2rem 0.4rem' : '0.75rem',
                        borderRadius: '4px',
                        fontSize: inline ? '0.9em' : '0.875rem',
                        display: inline ? 'inline-block' : 'block',
                        overflowX: 'auto',
                      }}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {part.content}
              </ReactMarkdown>
            </div>
          );
        })}

        {/* Render places data if available */}
        {message.places && message.places.length > 0 && (
          <PlacesList places={message.places} compact={true} />
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
