/**
 * AI API Routes
 * 
 * Provides endpoints for AI interactions using personas and rooms.
 */

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { generateResponse, checkCompatibility, chat } = require('../../controllers/aiController');
const auth = require('../../middleware/auth');
const disclaimer = require('../../middleware/disclaimer').default;
const { aiLimiter } = require('../../middleware/advancedRateLimiter');

/**
 * @route   POST /api/ai/chat
 * @desc    Generate AI response based on user input, persona, and room
 * @access  Private
 */
router.post('/chat', [
  auth, // Require authentication
  disclaimer, // Ensure user has acknowledged disclaimers
  aiLimiter, // Apply AI-specific rate limiting
  
  // Input validation
  check('userInput', 'User input is required').notEmpty().trim(),
  check('personaId', 'Persona ID is required').notEmpty().trim(),
  check('roomId', 'Room ID is required').notEmpty().trim(),
  check('saveToJournal', 'Save to journal must be a boolean').optional().isBoolean(),
  
  // Sanitize inputs
  check('userInput').escape(),
  check('personaId').escape(),
  check('roomId').escape()
], generateResponse);

/**
 * @route   GET /api/ai/compatibility/:personaId/:roomId
 * @desc    Check if a persona is compatible with a room
 * @access  Public
 */
router.get('/compatibility/:personaId/:roomId', [
  // Sanitize inputs
  check('personaId').escape(),
  check('roomId').escape()
], checkCompatibility);

/**
 * @route   POST /api/ai/direct-chat
 * @desc    Direct chat with Claude 3 Sonnet
 * @access  Private
 */
router.post('/direct-chat', [
  auth, // Require authentication
  aiLimiter, // Apply AI-specific rate limiting
  
  // Input validation
  check('message', 'Message is required').notEmpty().trim(),
  
  // Sanitize inputs
  check('message').escape()
], chat);

/**
 * @route   GET /api/ai/health
 * @desc    Check AI service health
 * @access  Public
 */
router.get('/health', (req, res) => {
  return res.json({
    status: 'success',
    data: {
      service: 'ai',
      status: 'operational'
    },
    message: 'AI service is operational'
  });
});

module.exports = router;
