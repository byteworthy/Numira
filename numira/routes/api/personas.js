const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const Persona = require('../../models/Persona');

// @route   GET api/personas
// @desc    Get all personas
// @access  Public
router.get('/', async (req, res) => {
  try {
    const personas = await Persona.find().sort({ name: 1 });
    res.json(personas);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/personas/:id
// @desc    Get persona by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const persona = await Persona.findById(req.params.id);

    if (!persona) {
      return res.status(404).json({ msg: 'Persona not found' });
    }

    res.json(persona);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Persona not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/personas
// @desc    Create a new persona (admin only in a real app)
// @access  Private (for demo purposes)
router.post(
  '/',
  [
    auth,
    [
      check('name', 'Name is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('systemPrompt', 'System prompt is required').not().isEmpty(),
      check('messageTemplate', 'Message template is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        description,
        systemPrompt,
        messageTemplate,
        avatarUrl,
        style,
        isDefault
      } = req.body;

      // Check if persona with same name already exists
      let persona = await Persona.findOne({ name });
      if (persona) {
        return res.status(400).json({ msg: 'Persona with this name already exists' });
      }

      // Create new persona
      const newPersona = new Persona({
        name,
        description,
        systemPrompt,
        messageTemplate,
        avatarUrl: avatarUrl || '/images/default-avatar.png',
        style: style || {},
        isDefault: isDefault || false
      });

      // If this is set as default, unset any existing defaults
      if (isDefault) {
        await Persona.updateMany(
          { isDefault: true },
          { $set: { isDefault: false } }
        );
      }

      persona = await newPersona.save();
      res.json(persona);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/personas/:id
// @desc    Update a persona (admin only in a real app)
// @access  Private (for demo purposes)
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      name,
      description,
      systemPrompt,
      messageTemplate,
      avatarUrl,
      style,
      isDefault
    } = req.body;

    // Build persona object
    const personaFields = {};
    if (name) personaFields.name = name;
    if (description) personaFields.description = description;
    if (systemPrompt) personaFields.systemPrompt = systemPrompt;
    if (messageTemplate) personaFields.messageTemplate = messageTemplate;
    if (avatarUrl) personaFields.avatarUrl = avatarUrl;
    if (style) personaFields.style = style;
    if (isDefault !== undefined) personaFields.isDefault = isDefault;

    let persona = await Persona.findById(req.params.id);

    if (!persona) {
      return res.status(404).json({ msg: 'Persona not found' });
    }

    // If this is set as default, unset any existing defaults
    if (isDefault) {
      await Persona.updateMany(
        { _id: { $ne: req.params.id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    persona = await Persona.findByIdAndUpdate(
      req.params.id,
      { $set: personaFields },
      { new: true }
    );

    res.json(persona);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Persona not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/personas/:id
// @desc    Delete a persona (admin only in a real app)
// @access  Private (for demo purposes)
router.delete('/:id', auth, async (req, res) => {
  try {
    const persona = await Persona.findById(req.params.id);

    if (!persona) {
      return res.status(404).json({ msg: 'Persona not found' });
    }

    // Don't allow deletion of default persona
    if (persona.isDefault) {
      return res.status(400).json({ msg: 'Cannot delete default persona' });
    }

    await persona.remove();
    res.json({ msg: 'Persona removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Persona not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
