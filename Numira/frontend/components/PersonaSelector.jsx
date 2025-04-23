import React, { useState, useEffect } from 'react';
import fetchPersonas from '../api/fetchPersonas';

/**
 * PersonaSelector Component
 * 
 * Displays a list of personas for the user to select from.
 * Fetches personas from the backend API.
 */
const PersonaSelector = ({ onSelectPersona, selectedPersonaId }) => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch personas on component mount
  useEffect(() => {
    const getPersonas = async () => {
      try {
        setLoading(true);
        const fetchedPersonas = await fetchPersonas();
        setPersonas(fetchedPersonas);
        setError(null);
        
        // If no persona is selected and we have personas, select the first one
        if (!selectedPersonaId && fetchedPersonas.length > 0) {
          onSelectPersona(fetchedPersonas[0].id);
        }
      } catch (err) {
        setError('Failed to load personas. Please try again later.');
        console.error('Error fetching personas:', err);
      } finally {
        setLoading(false);
      }
    };

    getPersonas();
  }, [onSelectPersona, selectedPersonaId]);

  // Handle persona selection
  const handlePersonaSelect = (personaId) => {
    onSelectPersona(personaId);
  };

  // Render loading state
  if (loading) {
    return <div className="persona-selector-loading">Loading personas...</div>;
  }

  // Render error state
  if (error) {
    return <div className="persona-selector-error">{error}</div>;
  }

  // Render empty state
  if (personas.length === 0) {
    return <div className="persona-selector-empty">No personas available.</div>;
  }

  return (
    <div className="persona-selector">
      <h2 className="persona-selector-title">Choose a Guide</h2>
      <div className="persona-selector-grid">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`persona-card ${selectedPersonaId === persona.id ? 'selected' : ''}`}
            onClick={() => handlePersonaSelect(persona.id)}
          >
            <h3 className="persona-name">{persona.name}</h3>
            <div className="persona-description">{persona.description}</div>
            <div className="persona-tags">
              {persona.tags && persona.tags.map((tag) => (
                <span key={tag} className="persona-tag">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonaSelector;
