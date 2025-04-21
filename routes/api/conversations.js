const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const Conversation = require('../../models/Conversation');
const Persona = require('../../models/Persona');
const User = require('../../models/User');

// @route   GET api/conversations
// @desc    Get all conversations for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.user.id })
      .sort({ lastUpdated: -1 })
      .populate('persona', ['name', 'avatarUrl']);
    res.json(conversations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/conversations/:id
// @desc    Get conversation by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('persona', ['name', 'avatarUrl', 'style']);

    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }

    // Check if user owns the conversation
    if (conversation.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    res.json(conversation);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Conversation not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/conversations
// @desc    Create a new conversation
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('persona', 'Persona is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { persona, title } = req.body;

      // Check if persona exists
      const personaObj = await Persona.findById(persona);
      if (!personaObj) {
        return res.status(404).json({ msg: 'Persona not found' });
      }

      // Create new conversation
      const newConversation = new Conversation({
        user: req.user.id,
        persona,
        title: title || 'New Conversation',
        messages: []
      });

      const conversation = await newConversation.save();
      res.json(conversation);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/conversations/:id
// @desc    Add a message to conversation
// @access  Private
router.put(
  '/:id',
  [
    auth,
    [
      check('content', 'Message content is required').not().isEmpty(),
      check('role', 'Role is required').isIn(['user', 'assistant'])
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const conversation = await Conversation.findById(req.params.id);

      // Check if conversation exists
      if (!conversation) {
        return res.status(404).json({ msg: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
      }

      const { content, role } = req.body;

      // Add message to conversation
      conversation.messages.push({
        content,
        role,
        timestamp: Date.now()
      });

      // Update conversation title if it's the first user message
      if (conversation.messages.length === 1 && role === 'user') {
        // Use the first ~30 chars of the message as the title
        conversation.title = content.length > 30 
          ? content.substring(0, 30) + '...' 
          : content;
      }

      await conversation.save();
      res.json(conversation);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Conversation not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   DELETE api/conversations/:id
// @desc    Delete a conversation
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    // Check if conversation exists
    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }

    // Check if user owns the conversation
    if (conversation.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await conversation.remove();
    res.json({ msg: 'Conversation removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Conversation not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
