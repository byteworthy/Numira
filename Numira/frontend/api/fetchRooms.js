/**
 * API utility to fetch all rooms from the backend
 */

/**
 * Get authentication token from localStorage
 * @returns {string} The JWT token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Fetch all rooms from the backend
 * @returns {Promise<Array>} Array of room objects
 */
const fetchRooms = async () => {
  try {
    const response = await fetch('/api/rooms', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch rooms');
    }

    const data = await response.json();
    return data.data; // The API returns data in a nested 'data' property
  } catch (error) {
    console.error('Error fetching rooms:', error);
    // Return empty array as fallback
    return [];
  }
};

export default fetchRooms;
