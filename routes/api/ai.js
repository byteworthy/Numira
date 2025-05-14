/**
 * AI Routes
 * 
 * Handles routes for AI-related operations including generating responses
 * and insights from conversations.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const aiController = require('../../controllers/aiController');

/**
 * Validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// @route   POST api/ai/respond
// @desc    Generate AI response for a conversation
// @access  Private
router.post(
  '/respond',
  [
    auth,
    [
      check('conversationId', 'Conversation ID is required').not().isEmpty(),
      check('message', 'Message is required').not().isEmpty()
    ],
    validateRequest
  ],
  aiController.generateResponse
);

// @route   POST api/ai/insights
// @desc    Generate insights from a conversation
// @access  Private
router.post(
  '/insights',
  [
    auth,
    [
      check('conversationId', 'Conversation ID is required').not().isEmpty()
    ],
    validateRequest
  ],
  aiController.generateInsights
);

module.exports = router;
