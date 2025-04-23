const OpenAI = require('openai');
const ModerationService = require('./moderationService');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI response based on the conversation history and selected persona
 * @param {Array} messages - Array of message objects with content and role
 * @param {Object} persona - Persona object with system prompt and message template
 * @returns {Promise<String>} - AI generated response
 */
const generateResponse = async (messages, persona) => {
  try {
    // Check if the user's last message is safe
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage) {
      const moderationResult = await ModerationService.checkUserInput(lastUserMessage.content);
      if (!moderationResult.safe) {
        return moderationResult.warningMessage;
      }
    }

    // Format messages for OpenAI API
    const formattedMessages = [
      {
        role: 'system',
        content: persona.systemPrompt
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Extract the response
    const response = completion.choices[0].message.content;
    
    // Filter the response through moderation
    const filteredResponse = await ModerationService.filterResponse(response);
    
    return filteredResponse;
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw new Error('Failed to generate AI response');
  }
};

/**
 * Generate insights from a conversation
 * @param {Array} messages - Array of message objects with content and role
 * @returns {Promise<Array>} - Array of insight strings
 */
const generateInsights = async (messages) => {
  try {
    // Create a prompt for generating insights
    const insightPrompt = `
      Based on the following conversation, identify 2-3 key insights or takeaways.
      Focus on meaningful patterns, realizations, or action items that emerged.
      Format each insight as a concise, standalone statement.
      Ensure insights are constructive, supportive, and focused on mental well-being.
      Avoid any potentially harmful, negative, or triggering content.
    `;

    // Format messages for OpenAI API
    const formattedMessages = [
      {
        role: 'system',
        content: insightPrompt
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    // Extract and parse insights
    const response = completion.choices[0].message.content;
    
    // Split by numbered items or bullet points and filter empty strings
    const rawInsights = response
      .split(/\d+\.\s|\n-\s|\n•\s/)
      .map(insight => insight.trim())
      .filter(insight => insight.length > 0);
    
    // Moderate each insight
    const moderatedInsights = [];
    for (const insight of rawInsights) {
      // Check if insight is safe
      const moderationResult = await ModerationService.moderateContent(insight);
      if (moderationResult.safe) {
        moderatedInsights.push(insight);
      } else {
        console.warn('Insight filtered by moderation:', insight);
      }
    }
    
    return moderatedInsights;
  } catch (error) {
    console.error('Error generating insights:', error);
    throw new Error('Failed to generate insights');
  }
};

/**
 * Generate a title for a conversation based on its content
 * @param {Array} messages - Array of message objects with content and role
 * @returns {Promise<String>} - Generated title
 */
const generateTitle = async (messages) => {
  try {
    // Create a prompt for generating a title
    const titlePrompt = `
      Based on the following conversation, generate a short, descriptive title (5-7 words max).
      The title should capture the essence of the conversation.
      Ensure the title is appropriate, non-triggering, and focused on mental well-being.
      Avoid any potentially harmful, negative, or sensitive content.
    `;

    // Format messages for OpenAI API
    const formattedMessages = [
      {
        role: 'system',
        content: titlePrompt
      },
      ...messages.slice(0, 3).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 50,
    });

    // Extract and clean up the title
    let title = completion.choices[0].message.content;
    
    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '');
    
    // Check if title is safe
    const moderationResult = await ModerationService.moderateContent(title);
    if (!moderationResult.safe) {
      console.warn('Title filtered by moderation:', title);
      // Return a generic safe title
      return 'New Conversation';
    }
    
    return title;
  } catch (error) {
    console.error('Error generating title:', error);
    // Return a fallback title
    return 'New Conversation';
  }
};

module.exports = {
  generateResponse,
  generateInsights,
  generateTitle
};
