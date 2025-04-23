import React from 'react';

/**
 * JournalToggle Component
 * 
 * A simple toggle switch to control whether to save the conversation to the journal.
 */
const JournalToggle = ({ saveToJournal, onToggle, disabled }) => {
  // Handle toggle change
  const handleChange = (e) => {
    onToggle(e.target.checked);
  };

  return (
    <div className="journal-toggle-container">
      <label className="journal-toggle-label">
        <input
          type="checkbox"
          className="journal-toggle-input"
          checked={saveToJournal}
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="journal-toggle-slider"></span>
        <span className="journal-toggle-text">
          {saveToJournal ? 'Save to Journal' : 'Don\'t Save to Journal'}
        </span>
      </label>
      <div className="journal-toggle-help">
        {saveToJournal 
          ? 'This conversation will be saved to your journal for future reference.' 
          : 'This conversation will not be saved to your journal.'}
      </div>
    </div>
  );
};

export default JournalToggle;
