/**
 * Authentication API Routes
 * 
 * Provides endpoints for user registration and authentication.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const { strictLimiter } = require('../../middleware/advancedRateLimiter');
const { registerUser, loginUser, getUserById } = require('../../services/authService');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
  strictLimiter, // Apply strict rate limiting to registration
  // Input validation
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password must be at least 8 characters').isLength({ min: 8 })
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Register user
    const { user, token } = await registerUser(email, password);

    // Return user and token
    return res.status(201).json({
      status: 'success',
      data: {
        user,
        token
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    
    // Handle specific errors
    if (error.message === 'User already exists') {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', [
  strictLimiter, // Apply strict rate limiting to login
  // Input validation
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password is required').exists()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Login user
    const { user, token } = await loginUser(email, password);

    // Return user and token
    return res.json({
      status: 'success',
      data: {
        user,
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error.message);
    
    // Handle specific errors
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    // Get user from database
    const user = await getUserById(req.user.id);
    
    return res.json({
      status: 'success',
      data: {
        user
      },
      message: 'User retrieved successfully'
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
