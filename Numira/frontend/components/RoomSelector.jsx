import React, { useState, useEffect } from 'react';
import fetchRooms from '../api/fetchRooms';

/**
 * RoomSelector Component
 * 
 * Displays a list of rooms for the user to select from.
 * Fetches rooms from the backend API.
 * Can filter rooms based on selected persona.
 */
const RoomSelector = ({ onSelectRoom, selectedRoomId, selectedPersonaId }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch rooms on component mount or when selectedPersonaId changes
  useEffect(() => {
    const getRooms = async () => {
      try {
        setLoading(true);
        const fetchedRooms = await fetchRooms();
        
        // Filter rooms by selected persona if needed
        const filteredRooms = selectedPersonaId
          ? fetchedRooms.filter(room => 
              room.supportedPersonas && room.supportedPersonas.includes(selectedPersonaId)
            )
          : fetchedRooms;
        
        setRooms(filteredRooms);
        setError(null);
        
        // If no room is selected and we have rooms, select the first one
        if (!selectedRoomId && filteredRooms.length > 0) {
          onSelectRoom(filteredRooms[0].id);
        } else if (selectedRoomId && !filteredRooms.some(room => room.id === selectedRoomId)) {
          // If the currently selected room is not compatible with the new persona, select the first compatible room
          if (filteredRooms.length > 0) {
            onSelectRoom(filteredRooms[0].id);
          } else {
            onSelectRoom(null);
          }
        }
      } catch (err) {
        setError('Failed to load rooms. Please try again later.');
        console.error('Error fetching rooms:', err);
      } finally {
        setLoading(false);
      }
    };

    getRooms();
  }, [onSelectRoom, selectedRoomId, selectedPersonaId]);

  // Handle room selection
  const handleRoomSelect = (roomId) => {
    onSelectRoom(roomId);
  };

  // Render loading state
  if (loading) {
    return <div className="room-selector-loading">Loading rooms...</div>;
  }

  // Render error state
  if (error) {
    return <div className="room-selector-error">{error}</div>;
  }

  // Render empty state
  if (rooms.length === 0) {
    return (
      <div className="room-selector-empty">
        {selectedPersonaId 
          ? 'No compatible rooms available for the selected persona.' 
          : 'No rooms available.'}
      </div>
    );
  }

  return (
    <div className="room-selector">
      <h2 className="room-selector-title">Choose a Room</h2>
      <div className="room-selector-grid">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`room-card ${selectedRoomId === room.id ? 'selected' : ''}`}
            onClick={() => handleRoomSelect(room.id)}
          >
            <h3 className="room-name">{room.name}</h3>
            <div className="room-description">{room.description}</div>
            <div className="room-purpose">{room.purpose}</div>
            <div className="room-tags">
              {room.tags && room.tags.map((tag) => (
                <span key={tag} className="room-tag">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomSelector;
