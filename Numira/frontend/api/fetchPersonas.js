/**
 * API utility to fetch all personas from the backend
 */

/**
 * Get authentication token from localStorage
 * @returns {string} The JWT token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Fetch all personas from the backend
 * @returns {Promise<Array>} Array of persona objects
 */
const fetchPersonas = async () => {
  try {
    const response = await fetch('/api/personas', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch personas');
    }

    const data = await response.json();
    return data.data; // The API returns data in a nested 'data' property
  } catch (error) {
    console.error('Error fetching personas:', error);
    // Return empty array as fallback
    return [];
  }
};

export default fetchPersonas;
