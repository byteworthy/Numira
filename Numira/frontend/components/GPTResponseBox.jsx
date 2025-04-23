import React from 'react';

/**
 * GPTResponseBox Component
 * 
 * Displays the AI's response to the user's prompt.
 * Handles loading and error states.
 */
const GPTResponseBox = ({ response, isLoading, error, personaName }) => {
  // Render loading state
  if (isLoading) {
    return (
      <div className="gpt-response-loading">
        <div className="loading-indicator">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <div className="loading-text">{personaName || 'AI'} is thinking...</div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="gpt-response-error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">
          {error.message || 'Something went wrong. Please try again.'}
        </div>
      </div>
    );
  }

  // Render empty state (no response yet)
  if (!response) {
    return (
      <div className="gpt-response-empty">
        <div className="empty-message">
          Send a message to start a conversation with {personaName || 'the AI'}.
        </div>
      </div>
    );
  }

  // Helper function to format text with line breaks
  const formatText = (text) => {
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Render response
  return (
    <div className="gpt-response">
      <div className="response-header">
        <div className="response-persona">{personaName || 'AI'}</div>
      </div>
      <div className="response-content">
        {formatText(response)}
      </div>
    </div>
  );
};

export default GPTResponseBox;
