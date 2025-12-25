import React from 'react';

function ChatInput({ input, setInput, onSend, onKeyDown, isLoading, inputRef }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1rem 0',
        background: 'var(--bg-secondary)',
      }}
    >
      <div className="container">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            ref={inputRef}
            type="text"
            className="input"
            placeholder="Ask about places to go, restaurants, directions..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={onSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
