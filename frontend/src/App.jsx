import { useState, useRef, useEffect } from 'react';
import { nanoid } from 'nanoid';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Header from './components/Header';
import { streamChat, getUserLocation } from './lib/ollama';

// Custom map tag regex
const MAP_TAG_REGEX = /<map\s+(placeId="([^"]+)"|query="([^"]+)")\s*\/>/g;

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get user location on load
  useEffect(() => {
    let locationFound = false;

    // Timeout: if location takes more than 3 seconds, proceed without it
    const timeoutId = setTimeout(() => {
      if (!locationFound) {
        setIsLoadingLocation(false);
        setLocationDenied(true);
      }
    }, 3000);

    getUserLocation().then((location) => {
      if (location) {
        locationFound = true;
        clearTimeout(timeoutId);
        setIsLoadingLocation(false);
        setUserLocation(location);
        console.log('User location:', location);
      } else {
        setIsLoadingLocation(false);
        setLocationDenied(true);
      }
    });

    return () => clearTimeout(timeoutId);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const requestLocation = async () => {
    setIsLoadingLocation(true);
    setLocationDenied(false);
    const location = await getUserLocation();
    setIsLoadingLocation(false);
    if (location) {
      setUserLocation(location);
    } else {
      setLocationDenied(true);
    }
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage = {
      id: nanoid(),
      role: 'user',
      content: trimmedInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    // Create assistant message for streaming
    const assistantId = nanoid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', places: null },
    ]);

    try {
      let fullContent = '';
      let placesData = null;

      await streamChat(
        [...messages, userMessage],
        (chunk) => {
          // Check if this is structured data (places)
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.type === 'places') {
              placesData = parsed.data;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, places: parsed.data }
                    : msg
                )
              );
              return;
            }
          } catch {
            // Not JSON, treat as content
          }

          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        },
        (errorMsg) => {
          setError(errorMsg);
        },
        userLocation
      );
    } catch (err) {
      setError(err.message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${err.message}`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onClear={clearChat} messageCount={messages.length} />

      {/* Location status indicator */}
      {isLoadingLocation && (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            textAlign: 'center',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          🔄 Getting your location for distance calculation...
        </div>
      )}
      {userLocation && !isLoadingLocation && (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          📍 Location enabled - distances calculated from your position
        </div>
      )}
      {locationDenied && !userLocation && !isLoadingLocation && (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>📍 Location disabled</span>
          <button
            onClick={requestLocation}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Enable
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem 0',
        }}
      >
        <div className="container">
          {messages.length === 0 && !error && (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-secondary)',
              }}
            >
              <h2>HeyPico</h2>
              <p style={{ marginTop: '0.5rem' }}>
                Local LLM with Google Maps integration
              </p>
              <div
                style={{
                  marginTop: '2rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  maxWidth: '600px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                {[
                  'Find coffee shops nearby',
                  'Show me restaurants near me',
                  'What are some attractions in Taipei?',
                  'Find gas stations around here',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    className="btn"
                    onClick={() => setInput(prompt)}
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      height: 'auto',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isStreaming && (
            <div
              style={{
                padding: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              Thinking...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '1rem',
                margin: '1rem 0',
                background: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid rgba(248, 81, 73, 0.3)',
                borderRadius: '6px',
                color: '#f85149',
              }}
            >
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        isLoading={isLoading}
        inputRef={inputRef}
      />
    </div>
  );
}

export default App;
