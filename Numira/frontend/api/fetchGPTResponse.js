/**
 * API utility to fetch AI responses from the backend
 */

/**
 * Get authentication token from localStorage
 * @returns {string} The JWT token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Send a prompt to the AI and get a response
 * 
 * @param {Object} params - Parameters for the AI request
 * @param {string} params.personaId - ID of the selected persona
 * @param {string} params.roomId - ID of the selected room
 * @param {string} params.userInput - User's prompt/message
 * @param {boolean} params.saveToJournal - Whether to save the conversation to journal
 * @returns {Promise<Object>} The AI response object
 */
const fetchGPTResponse = async ({ personaId, roomId, userInput, saveToJournal = false }) => {
  try {
    // Validate required parameters
    if (!personaId || !roomId || !userInput) {
      throw new Error('Missing required parameters: personaId, roomId, and userInput are required');
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        personaId,
        roomId,
        prompt: userInput,
        saveToJournal
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.data; // The API returns data in a nested 'data' property
  } catch (error) {
    console.error('Error fetching AI response:', error);
    // Return error object that can be handled by the UI
    return {
      error: true,
      message: error.message || 'Failed to get AI response. Please try again.'
    };
  }
};

export default fetchGPTResponse;
