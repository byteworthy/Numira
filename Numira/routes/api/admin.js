const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');

// Import admin sub-routes
const billingRoutes = require('./admin/billing');
const telemetryRoutes = require('./admin/telemetry');

// Use admin sub-routes
router.use('/billing', billingRoutes);
router.use('/telemetry', telemetryRoutes);

/**
 * @route   GET api/admin/health
 * @desc    Health check endpoint for admin API
 * @access  Public
 */
router.get('/health', (req, res) => {
  logger.info('Admin API health check');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Admin API is operational',
    timestamp: new Date().toISOString() 
  });
});

/**
 * @route   GET api/admin
 * @desc    Admin dashboard overview endpoint
 * @access  Private (Admin)
 */
router.get('/', [auth, roleCheck(['admin'])], (req, res) => {
  logger.info('Admin dashboard accessed', { userId: req.user.id });
  return res.status(200).json({ 
    message: 'Admin dashboard API',
    timestamp: new Date().toISOString(),
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

module.exports = router;
