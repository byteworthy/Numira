/**
 * AI Controller
 * 
 * Handles HTTP requests related to AI interactions.
 * Acts as a bridge between API routes and the AI service.
 */

const { getAIResponse } = require('../services/aiService');
const { validationResult } = require('express-validator');
const { anthropic } = require('../services/llmProviderService');

/**
 * Generate AI response based on user input, persona, and room
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function generateResponse(req, res) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { userInput, personaId, roomId, saveToJournal = false } = req.body;
    
    // Get user ID from authenticated user or use a default
    const userId = req.user?.id || 'anonymous';
    
    // Call AI service
    const aiResponse = await getAIResponse({
      userInput,
      personaId,
      roomId,
      userId,
      saveToJournal
    });
    
    // Return successful response
    return res.json({
      status: 'success',
      data: {
        response: aiResponse
      },
      message: 'AI response generated successfully',
      metadata: {
        personaId,
        roomId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        status: 'error',
        message: error.message,
        metadata: {
          retryAfter: '1 hour' // Should match the rate limit window
        }
      });
    }
    
    if (error.message.includes('Persona not found') || 
        error.message.includes('Room not found') ||
        error.message.includes('not compatible')) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
    
    // Generic error handling
    console.error('AI Controller Error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while generating AI response'
    });
  }
}

/**
 * Get compatibility information for a persona-room combination
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
function checkCompatibility(req, res) {
  try {
    const { personaId, roomId } = req.params;
    
    // Load configurations
    const personas = require('../config/personas');
    const rooms = require('../config/rooms');
    
    // Find persona and room
    const persona = personas.find(p => p.id === personaId);
    const room = rooms.find(r => r.id === roomId);
    
    if (!persona) {
      return res.status(404).json({
        status: 'error',
        message: `Persona not found: ${personaId}`
      });
    }
    
    if (!room) {
      return res.status(404).json({
        status: 'error',
        message: `Room not found: ${roomId}`
      });
    }
    
    // Check compatibility
    const isCompatible = room.supportedPersonas.includes(personaId);
    
    return res.json({
      status: 'success',
      data: {
        personaId,
        roomId,
        isCompatible,
        personaName: persona.name,
        roomName: room.name
      },
      message: isCompatible 
        ? `${persona.name} is compatible with ${room.name}`
        : `${persona.name} is not compatible with ${room.name}`
    });
  } catch (error) {
    console.error('AI Controller Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while checking compatibility'
    });
  }
}

/**
 * Direct chat with Claude 3 Sonnet
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function chat(req, res) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Message is required'
      });
    }

    // Call Claude directly
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet',
      system: 'You are a helpful AI assistant.',
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    // Return successful response
    return res.json({
      status: 'success',
      data: response,
      message: 'Claude response generated successfully'
    });
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        status: 'error',
        message: error.message,
        metadata: {
          retryAfter: '1 hour'
        }
      });
    }
    
    // Generic error handling
    console.error('AI Controller Error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while generating Claude response'
    });
  }
}

module.exports = {
  generateResponse,
  checkCompatibility,
  chat
};
