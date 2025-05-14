/**
 * AI Controller
 * 
 * Handles AI-related operations including generating responses,
 * insights, and conversation titles.
 */

const Conversation = require('../models/Conversation');
const Persona = require('../models/Persona');
const Insight = require('../models/Insight');
const aiService = require('../services/aiService');

/**
 * Generate AI response for a conversation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.generateResponse = async (req, res, next) => {
  try {
    const { conversationId, message } = req.body;

    // Get conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('persona');

    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        errors: [{ msg: 'The requested conversation does not exist' }]
      });
    }

    // Check if user owns the conversation
    if (conversation.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        errors: [{ msg: 'You do not have permission to access this conversation' }]
      });
    }

    // Add user message to conversation
    conversation.messages.push({
      content: message,
      role: 'user',
      timestamp: Date.now()
    });

    // Generate AI response
    const aiResponse = await aiService.generateResponse(
      conversation.messages,
      conversation.persona
    );

    // Add AI response to conversation
    conversation.messages.push({
      content: aiResponse,
      role: 'assistant',
      timestamp: Date.now()
    });

    // Update conversation title if it's the first message
    if (conversation.messages.length <= 3 && conversation.title === 'New Conversation') {
      const title = await aiService.generateTitle(conversation.messages);
      conversation.title = title;
    }

    await conversation.save();
    
    // Return standardized response
    res.json({
      success: true,
      data: conversation,
      message: 'Response generated successfully'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate insights from a conversation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.generateInsights = async (req, res, next) => {
  try {
    const { conversationId } = req.body;

    // Get conversation
    const conversation = await Conversation.findById(conversationId);

    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        errors: [{ msg: 'The requested conversation does not exist' }]
      });
    }

    // Check if user owns the conversation
    if (conversation.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        errors: [{ msg: 'You do not have permission to access this conversation' }]
      });
    }

    // Check if conversation has enough messages
    if (conversation.messages.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient conversation data',
        errors: [{ msg: 'Conversation needs more messages to generate insights' }]
      });
    }

    // Generate insights
    const insightTexts = await aiService.generateInsights(conversation.messages);
    
    // Create insight objects
    const insights = [];
    
    for (const content of insightTexts) {
      const newInsight = new Insight({
        user: req.user.id,
        conversation: conversationId,
        content,
        tags: []
      });
      
      await newInsight.save();
      insights.push(newInsight);
    }
    
    // Return standardized response
    res.json({
      success: true,
      data: insights,
      message: 'Insights generated successfully'
    });
  } catch (err) {
    next(err);
  }
};
