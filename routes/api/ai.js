const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const Conversation = require('../../models/Conversation');
const Persona = require('../../models/Persona');
const Insight = require('../../models/Insight');
const aiService = require('../../services/aiService');

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
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { conversationId, message } = req.body;

      // Get conversation
      const conversation = await Conversation.findById(conversationId)
        .populate('persona');

      // Check if conversation exists
      if (!conversation) {
        return res.status(404).json({ msg: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
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
      res.json(conversation);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
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
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { conversationId } = req.body;

      // Get conversation
      const conversation = await Conversation.findById(conversationId);

      // Check if conversation exists
      if (!conversation) {
        return res.status(404).json({ msg: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
      }

      // Check if conversation has enough messages
      if (conversation.messages.length < 3) {
        return res.status(400).json({ 
          msg: 'Conversation needs more messages to generate insights' 
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
      
      res.json(insights);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;
