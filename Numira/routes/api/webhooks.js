const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * @route   GET api/webhooks/health
 * @desc    Health check endpoint for webhooks API
 * @access  Public
 */
router.get('/health', (req, res) => {
  logger.info('Webhooks API health check');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Webhooks API is operational',
    timestamp: new Date().toISOString() 
  });
});

/**
 * @route   GET api/webhooks
 * @desc    Placeholder endpoint for webhooks API
 * @access  Public
 */
router.get('/', (req, res) => {
  logger.info('Webhooks API placeholder endpoint accessed');
  return res.status(200).json({ 
    message: 'Webhooks API placeholder - functionality to be implemented',
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;
