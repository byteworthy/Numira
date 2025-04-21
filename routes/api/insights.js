const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const Insight = require('../../models/Insight');
const Conversation = require('../../models/Conversation');

// @route   GET api/insights
// @desc    Get all insights for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const insights = await Insight.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('conversation', 'title');
    res.json(insights);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/insights/:id
// @desc    Get insight by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id)
      .populate('conversation', 'title');

    // Check if insight exists
    if (!insight) {
      return res.status(404).json({ msg: 'Insight not found' });
    }

    // Check if user owns the insight
    if (insight.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    res.json(insight);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Insight not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/insights
// @desc    Create a new insight
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('conversation', 'Conversation ID is required').not().isEmpty(),
      check('content', 'Content is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { conversation, content, tags } = req.body;

      // Check if conversation exists and belongs to user
      const conversationObj = await Conversation.findById(conversation);
      if (!conversationObj) {
        return res.status(404).json({ msg: 'Conversation not found' });
      }
      
      if (conversationObj.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
      }

      // Create new insight
      const newInsight = new Insight({
        user: req.user.id,
        conversation,
        content,
        tags: tags || []
      });

      const insight = await newInsight.save();
      res.json(insight);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/insights/:id
// @desc    Update an insight
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);

    // Check if insight exists
    if (!insight) {
      return res.status(404).json({ msg: 'Insight not found' });
    }

    // Check if user owns the insight
    if (insight.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    const { content, tags } = req.body;

    // Update insight
    if (content) insight.content = content;
    if (tags) insight.tags = tags;

    await insight.save();
    res.json(insight);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Insight not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/insights/:id
// @desc    Delete an insight
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);

    // Check if insight exists
    if (!insight) {
      return res.status(404).json({ msg: 'Insight not found' });
    }

    // Check if user owns the insight
    if (insight.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await insight.remove();
    res.json({ msg: 'Insight removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Insight not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
