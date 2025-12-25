import React from 'react';

function Header({ onClear, messageCount }) {
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    // Check if Ollama is available
    fetch('/ollama/api/tags')
      .then((res) => res.ok && setIsConnected(true))
      .catch(() => setIsConnected(false));
  }, []);

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 0',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>HeyPico</h1>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '100px',
              background: isConnected
                ? 'rgba(63, 185, 77, 0.15)'
                : 'rgba(248, 81, 73, 0.15)',
              color: isConnected ? '#3fb950' : '#f85149',
            }}
          >
            {isConnected ? '● Ollama Connected' : '○ Ollama Disconnected'}
          </span>
        </div>
        {messageCount > 0 && (
          <button className="btn" onClick={onClear}>
            Clear Chat
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
