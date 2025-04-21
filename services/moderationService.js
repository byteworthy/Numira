const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Service for content moderation to ensure safe and appropriate AI responses
 */
class ModerationService {
  /**
   * Check if content contains harmful or inappropriate material
   * @param {string} content - The content to check
   * @returns {Promise<Object>} - Moderation result with flags and categories
   */
  static async moderateContent(content) {
    try {
      // If no content or empty string, return safe result
      if (!content || content.trim() === '') {
        return {
          flagged: false,
          categories: {},
          categoryScores: {},
          safe: true
        };
      }

      // Use OpenAI's moderation API
      if (config.AI_PROVIDER === 'openai' && config.OPENAI_API_KEY) {
        return await this.moderateWithOpenAI(content);
      }
      
      // Use Claude's moderation capabilities
      if (config.AI_PROVIDER === 'anthropic' && config.ANTHROPIC_API_KEY) {
        return await this.moderateWithClaude(content);
      }
      
      // Fallback to basic keyword filtering if no API keys are available
      return await this.moderateWithKeywords(content);
    } catch (error) {
      logger.error('Error in content moderation:', error);
      
      // In case of error, default to allowing the content but log the error
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        safe: true,
        error: error.message
      };
    }
  }

  /**
   * Moderate content using OpenAI's moderation API
   * @param {string} content - The content to check
   * @returns {Promise<Object>} - Moderation result
   */
  static async moderateWithOpenAI(content) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/moderations',
        { input: content },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`
          }
        }
      );
      
      const result = response.data.results[0];
      
      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores,
        safe: !result.flagged
      };
    } catch (error) {
      logger.error('Error in OpenAI moderation:', error);
      throw error;
    }
  }

  /**
   * Moderate content using Claude's capabilities
   * @param {string} content - The content to check
   * @returns {Promise<Object>} - Moderation result
   */
  static async moderateWithClaude(content) {
    try {
      // Claude doesn't have a dedicated moderation API, so we use the chat API with a prompt
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: "You are a content moderation system. Your task is to analyze the provided text and determine if it contains harmful, inappropriate, or unsafe content. Respond with a JSON object containing 'flagged' (boolean), 'categories' (object with boolean values for different harm categories), 'categoryScores' (object with scores from 0-1 for each category), and 'safe' (boolean, the opposite of flagged). Categories to check: violence, sexual, hate, harassment, selfHarm, and misinformation.",
          messages: [
            {
              role: 'user',
              content: `Please analyze this content for safety and appropriateness: "${content}"`
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      // Parse the JSON response from Claude
      const responseText = response.data.content[0].text;
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/{[\s\S]*?}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const result = JSON.parse(jsonStr);
        
        return {
          flagged: result.flagged,
          categories: result.categories,
          categoryScores: result.categoryScores,
          safe: result.safe
        };
      }
      
      // If we couldn't parse JSON, default to safe but log the issue
      logger.warn('Could not parse Claude moderation response:', responseText);
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        safe: true
      };
    } catch (error) {
      logger.error('Error in Claude moderation:', error);
      throw error;
    }
  }

  /**
   * Basic keyword-based moderation as a fallback
   * @param {string} content - The content to check
   * @returns {Promise<Object>} - Moderation result
   */
  static async moderateWithKeywords(content) {
    // Convert to lowercase for case-insensitive matching
    const lowerContent = content.toLowerCase();
    
    // Define categories and keywords
    const categories = {
      violence: ['kill', 'attack', 'murder', 'bomb', 'shoot', 'assault', 'weapon'],
      sexual: ['porn', 'explicit', 'nsfw', 'sex', 'nude', 'naked'],
      hate: ['hate', 'racist', 'bigot', 'nazi', 'supremacist'],
      harassment: ['harass', 'bully', 'stalk', 'threaten'],
      selfHarm: ['suicide', 'self-harm', 'kill myself', 'cut myself'],
      misinformation: ['fake news', 'conspiracy', 'hoax']
    };
    
    // Check each category
    const results = {
      flagged: false,
      categories: {},
      categoryScores: {},
      safe: true
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;
      
      // Check each keyword in the category
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
          // Simple scoring - increase score based on keyword matches
          score += 0.3;
          
          // Cap at 1.0
          if (score > 1) score = 1;
        }
      }
      
      // Set category results
      results.categories[category] = score >= 0.5;
      results.categoryScores[category] = score;
      
      // If any category is flagged, the content is flagged
      if (score >= 0.5) {
        results.flagged = true;
        results.safe = false;
      }
    }
    
    return results;
  }

  /**
   * Filter and sanitize AI response based on moderation results
   * @param {string} response - The AI response to filter
   * @returns {Promise<string>} - Filtered response
   */
  static async filterResponse(response) {
    try {
      // Check if response contains harmful content
      const moderationResult = await this.moderateContent(response);
      
      // If the response is safe, return it as is
      if (moderationResult.safe) {
        return response;
      }
      
      // Log the moderation result for review
      logger.warn('AI response flagged by moderation:', {
        flagged: moderationResult.flagged,
        categories: moderationResult.categories,
        response: response.substring(0, 100) + '...' // Log just the beginning for reference
      });
      
      // Replace the response with a safe alternative
      return this.generateSafeAlternative(response, moderationResult);
    } catch (error) {
      logger.error('Error filtering AI response:', error);
      
      // In case of error, return a generic safe response
      return "I apologize, but I'm unable to provide a response to that. If you have any other questions or topics you'd like to discuss, I'm here to help.";
    }
  }

  /**
   * Generate a safe alternative response
   * @param {string} originalResponse - The original flagged response
   * @param {Object} moderationResult - The moderation result
   * @returns {string} - Safe alternative response
   */
  static generateSafeAlternative(originalResponse, moderationResult) {
    // Determine which categories were flagged
    const flaggedCategories = Object.entries(moderationResult.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);
    
    // Generic safe response based on flagged categories
    if (flaggedCategories.includes('violence') || 
        flaggedCategories.includes('hate') || 
        flaggedCategories.includes('harassment')) {
      return "I apologize, but I can't provide a response that might contain harmful content. I'm designed to be helpful, harmless, and honest. Let's discuss something more constructive that can help with your mental clarity and well-being.";
    }
    
    if (flaggedCategories.includes('sexual')) {
      return "I apologize, but I can't provide a response to that request as it appears to involve inappropriate content. I'm here to help with your mental clarity and well-being in a constructive way. Is there something else I can assist you with?";
    }
    
    if (flaggedCategories.includes('selfHarm')) {
      return "I notice your message might relate to self-harm or difficult emotions. If you're experiencing thoughts of harming yourself, please reach out to a mental health professional or crisis helpline immediately. The National Suicide Prevention Lifeline is available 24/7 at 1-800-273-8255. Would you like to talk about coping strategies or resources that might help you navigate these feelings in a healthier way?";
    }
    
    if (flaggedCategories.includes('misinformation')) {
      return "I want to be careful about providing accurate information. The response I was about to give might contain inaccuracies. Instead, I'd encourage you to consult reliable sources on this topic. Is there another way I can help you today?";
    }
    
    // Default safe response if no specific category handling
    return "I apologize, but I'm unable to provide the response I generated as it may not align with our content guidelines. I'm here to support your mental clarity and well-being in a constructive way. Is there something else I can help you with?";
  }

  /**
   * Check if user input contains harmful or inappropriate content
   * @param {string} userInput - The user input to check
   * @returns {Promise<Object>} - Result with safe status and optional warning message
   */
  static async checkUserInput(userInput) {
    try {
      // Moderate the user input
      const moderationResult = await this.moderateContent(userInput);
      
      // If the input is safe, return success
      if (moderationResult.safe) {
        return {
          safe: true
        };
      }
      
      // Log the moderation result for review
      logger.warn('User input flagged by moderation:', {
        flagged: moderationResult.flagged,
        categories: moderationResult.categories,
        input: userInput.substring(0, 100) + '...' // Log just the beginning for reference
      });
      
      // Determine which categories were flagged
      const flaggedCategories = Object.entries(moderationResult.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);
      
      // Generate appropriate warning message
      let warningMessage = "I'm unable to respond to that message as it appears to contain content that goes against our community guidelines.";
      
      if (flaggedCategories.includes('selfHarm')) {
        warningMessage = "I notice your message might relate to self-harm or difficult emotions. If you're experiencing thoughts of harming yourself, please reach out to a mental health professional or crisis helpline immediately. The National Suicide Prevention Lifeline is available 24/7 at 1-800-273-8255.";
      } else if (flaggedCategories.includes('violence') || 
                flaggedCategories.includes('hate') || 
                flaggedCategories.includes('harassment')) {
        warningMessage = "I'm unable to respond to messages that contain harmful content. I'm designed to be helpful and supportive. Let's discuss something more constructive that can help with your mental clarity and well-being.";
      }
      
      return {
        safe: false,
        warningMessage
      };
    } catch (error) {
      logger.error('Error checking user input:', error);
      
      // In case of error, default to allowing the input but log the error
      return {
        safe: true,
        error: error.message
      };
    }
  }
}

module.exports = ModerationService;
