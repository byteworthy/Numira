import React, { useState, useEffect } from 'react';
import fetchJournals from '../api/fetchJournals';

/**
 * JournalList Component
 * 
 * Displays a list of the user's journal entries.
 * Fetches journal entries from the backend API.
 */
const JournalList = () => {
  const [journals, setJournals] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJournal, setSelectedJournal] = useState(null);

  // Fetch journals on component mount
  useEffect(() => {
    const getJournals = async () => {
      try {
        setLoading(true);
        const result = await fetchJournals({
          limit: pagination.limit,
          offset: pagination.offset
        });
        
        setJournals(result.journals || []);
        setPagination(result.pagination || {
          total: 0,
          limit: pagination.limit,
          offset: pagination.offset,
          hasMore: false
        });
        setError(null);
      } catch (err) {
        setError('Failed to load journal entries. Please try again later.');
        console.error('Error fetching journals:', err);
      } finally {
        setLoading(false);
      }
    };

    getJournals();
  }, [pagination.limit, pagination.offset]);

  // Handle pagination
  const handleLoadMore = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  // Handle journal selection
  const handleJournalSelect = (journal) => {
    setSelectedJournal(selectedJournal?.id === journal.id ? null : journal);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render loading state
  if (loading && journals.length === 0) {
    return <div className="journal-list-loading">Loading journal entries...</div>;
  }

  // Render error state
  if (error && journals.length === 0) {
    return <div className="journal-list-error">{error}</div>;
  }

  // Render empty state
  if (journals.length === 0) {
    return (
      <div className="journal-list-empty">
        <div className="empty-message">
          No journal entries yet. Start a conversation and toggle "Save to Journal" to create one.
        </div>
      </div>
    );
  }

  return (
    <div className="journal-list">
      <h2 className="journal-list-title">Your Journal</h2>
      
      <div className="journal-entries">
        {journals.map((journal) => (
          <div 
            key={journal.id} 
            className={`journal-entry ${selectedJournal?.id === journal.id ? 'selected' : ''}`}
            onClick={() => handleJournalSelect(journal)}
          >
            <div className="journal-entry-header">
              <div className="journal-entry-date">{formatDate(journal.createdAt)}</div>
              <div className="journal-entry-persona">{journal.personaId}</div>
              <div className="journal-entry-room">{journal.roomId}</div>
            </div>
            
            <div className="journal-entry-prompt">{journal.prompt}</div>
            
            {selectedJournal?.id === journal.id && (
              <div className="journal-entry-response">{journal.response}</div>
            )}
          </div>
        ))}
      </div>
      
      {pagination.hasMore && (
        <button 
          className="journal-list-load-more"
          onClick={handleLoadMore}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
};

export default JournalList;
