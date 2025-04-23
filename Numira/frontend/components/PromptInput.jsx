import React, { useState } from 'react';

/**
 * PromptInput Component
 * 
 * Provides a text input for the user to enter their prompt/message.
 * Handles submission to the AI service.
 */
const PromptInput = ({ onSubmit, isLoading, disabled }) => {
  const [userInput, setUserInput] = useState('');

  // Handle input change
  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Don't submit if input is empty or only whitespace
    if (!userInput.trim()) {
      return;
    }
    
    // Call the onSubmit callback with the user input
    onSubmit(userInput);
    
    // Clear the input field
    setUserInput('');
  };

  // Handle Enter key press
  const handleKeyDown = (e) => {
    // Submit on Enter, but allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="prompt-input-container">
      <form onSubmit={handleSubmit} className="prompt-input-form">
        <textarea
          className="prompt-input-textarea"
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          disabled={isLoading || disabled}
          rows={3}
          aria-label="Your message"
        />
        <button
          type="submit"
          className="prompt-input-submit"
          disabled={isLoading || disabled || !userInput.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
      <div className="prompt-input-help">
        Press Enter to send, Shift+Enter for a new line
      </div>
    </div>
  );
};

export default PromptInput;
