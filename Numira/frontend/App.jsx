import React, { useState } from 'react';
import PersonaSelector from './components/PersonaSelector';
import RoomSelector from './components/RoomSelector';
import PromptInput from './components/PromptInput';
import GPTResponseBox from './components/GPTResponseBox';
import JournalToggle from './components/JournalToggle';
import JournalList from './components/JournalList';
import fetchGPTResponse from './api/fetchGPTResponse';

/**
 * Main App Component
 * 
 * Orchestrates the Numira application, combining all components
 * and managing the application state.
 */
const App = () => {
  // State for persona and room selection
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  
  // State for AI response
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for journal toggle
  const [saveToJournal, setSaveToJournal] = useState(true);
  
  // State for view toggle (chat or journal)
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'journal'
  
  // State for selected persona and room names (for display)
  const [personaName, setPersonaName] = useState('');
  const [roomName, setRoomName] = useState('');

  // Handle persona selection
  const handleSelectPersona = (personaId, name) => {
    setSelectedPersonaId(personaId);
    if (name) setPersonaName(name);
  };

  // Handle room selection
  const handleSelectRoom = (roomId, name) => {
    setSelectedRoomId(roomId);
    if (name) setRoomName(name);
  };

  // Handle prompt submission
  const handleSubmitPrompt = async (userInput) => {
    if (!selectedPersonaId || !selectedRoomId) {
      setError({
        message: 'Please select a persona and room before sending a message.'
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchGPTResponse({
        personaId: selectedPersonaId,
        roomId: selectedRoomId,
        userInput,
        saveToJournal
      });

      if (result.error) {
        setError({
          message: result.message || 'Failed to get AI response. Please try again.'
        });
      } else {
        setResponse(result.response || '');
      }
    } catch (err) {
      setError({
        message: 'An unexpected error occurred. Please try again.'
      });
      console.error('Error submitting prompt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle journal toggle
  const handleJournalToggle = (value) => {
    setSaveToJournal(value);
  };

  // Handle view toggle
  const handleViewToggle = (view) => {
    setActiveView(view);
  };

  return (
    <div className="numira-app">
      <header className="app-header">
        <h1 className="app-title">Numira</h1>
        <div className="view-toggle">
          <button
            className={`view-toggle-button ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => handleViewToggle('chat')}
          >
            Chat
          </button>
          <button
            className={`view-toggle-button ${activeView === 'journal' ? 'active' : ''}`}
            onClick={() => handleViewToggle('journal')}
          >
            Journal
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeView === 'chat' ? (
          <div className="chat-view">
            <div className="selectors-container">
              <PersonaSelector
                onSelectPersona={handleSelectPersona}
                selectedPersonaId={selectedPersonaId}
              />
              
              <RoomSelector
                onSelectRoom={handleSelectRoom}
                selectedRoomId={selectedRoomId}
                selectedPersonaId={selectedPersonaId}
              />
            </div>
            
            <div className="conversation-container">
              <GPTResponseBox
                response={response}
                isLoading={isLoading}
                error={error}
                personaName={personaName}
              />
              
              <div className="input-container">
                <JournalToggle
                  saveToJournal={saveToJournal}
                  onToggle={handleJournalToggle}
                  disabled={isLoading}
                />
                
                <PromptInput
                  onSubmit={handleSubmitPrompt}
                  isLoading={isLoading}
                  disabled={!selectedPersonaId || !selectedRoomId}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="journal-view">
            <JournalList />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="disclaimer">
          Numira is not a medical tool and does not provide therapy, mental health advice, or diagnosis of any kind.
        </div>
      </footer>
    </div>
  );
};

export default App;
