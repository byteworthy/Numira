const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const User = require('../../models/User');

// Define functions that were previously in userservice.js
const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

const createUser = async (userData) => {
  const user = new User(userData);
  await user.save();
  return user;
};

const updateUserPreferences = async (userId, preferences) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: preferences },
    { new: true }
  ).select('-password');
  return user;
};

router.post(
  '/',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    try {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = await createUser({ name, email, password: hashedPassword });
      const payload = {
        user: {
          id: newUser.id
        }
      };
      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).send('Server error');
    }
  }
);

router.put('/preferences', auth, async (req, res) => {
  try {
    const { theme, defaultPersona, notificationsEnabled } = req.body;
    const updatedUser = await updateUserPreferences(req.user.id, {
      theme,
      defaultPersona,
      notificationsEnabled
    });
    res.json(updatedUser);
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;