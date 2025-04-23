/**
 * API utility to create a journal entry directly
 */

/**
 * Get authentication token from localStorage
 * @returns {string} The JWT token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Create a new journal entry
 * 
 * @param {Object} journalData - Journal entry data
 * @param {string} journalData.personaId - ID of the selected persona
 * @param {string} journalData.roomId - ID of the selected room
 * @param {string} journalData.prompt - User's prompt/message
 * @param {string} journalData.response - AI's response
 * @returns {Promise<Object>} The created journal entry
 */
const postJournal = async (journalData) => {
  try {
    const { personaId, roomId, prompt, response } = journalData;

    // Validate required parameters
    if (!personaId || !roomId || !prompt || !response) {
      throw new Error('Missing required parameters: personaId, roomId, prompt, and response are required');
    }

    const requestData = {
      personaId,
      roomId,
      prompt,
      response
    };

    const apiResponse = await fetch('/api/journals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(requestData)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.message || 'Failed to create journal entry');
    }

    const data = await apiResponse.json();
    return data.data; // The API returns data in a nested 'data' property
  } catch (error) {
    console.error('Error creating journal entry:', error);
    // Return error object that can be handled by the UI
    return {
      error: true,
      message: error.message || 'Failed to create journal entry. Please try again.'
    };
  }
};

export default postJournal;
