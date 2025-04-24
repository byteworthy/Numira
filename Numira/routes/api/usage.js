const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * @route   GET api/usage/health
 * @desc    Health check endpoint for usage API
 * @access  Public
 */
router.get('/health', (req, res) => {
  logger.info('Usage API health check');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Usage API is operational',
    timestamp: new Date().toISOString() 
  });
});

/**
 * @route   GET api/usage
 * @desc    Placeholder endpoint for usage API
 * @access  Public
 */
router.get('/', (req, res) => {
  logger.info('Usage API placeholder endpoint accessed');
  return res.status(200).json({ 
    message: 'Usage API placeholder - functionality to be implemented',
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;
