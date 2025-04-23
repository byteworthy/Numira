/**
 * API utility to fetch journal entries from the backend
 */

/**
 * Get authentication token from localStorage
 * @returns {string} The JWT token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Fetch journal entries from the backend
 * 
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of entries to return (default: 20)
 * @param {number} options.offset - Number of entries to skip (default: 0)
 * @param {string} options.sortBy - Field to sort by (default: 'createdAt')
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc', default: 'desc')
 * @returns {Promise<Object>} Object containing journal entries and pagination info
 */
const fetchJournals = async (options = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build query string
    const queryParams = new URLSearchParams({
      limit,
      offset,
      sortBy,
      sortOrder
    }).toString();

    const response = await fetch(`/api/journals?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch journal entries');
    }

    const data = await response.json();
    return data.data; // The API returns data in a nested 'data' property
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    // Return empty object with journals array as fallback
    return {
      journals: [],
      pagination: {
        total: 0,
        limit: options.limit || 20,
        offset: options.offset || 0,
        hasMore: false
      }
    };
  }
};

export default fetchJournals;
