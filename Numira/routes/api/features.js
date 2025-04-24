/**
 * Features API Routes
 * 
 * Provides endpoints to get and manage feature flags.
 */

const express = require('express');
const router = express.Router();
const featureFlags = require('../../config/featureFlags');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');
const { validateInput, schemas } = require('../../middleware/validateInput');
const { z } = require('zod');

/**
 * @route   GET /api/features
 * @desc    Get all feature flags for the current user
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Get user ID if authenticated
    const userId = req.user ? req.user.id : null;
    const orgId = req.user ? req.user.orgId : null;
    
    // Get feature flags
    const flags = await featureFlags.getAllFlags({ userId, orgId });
    
    // Filter out internal flags for public access
    const publicFlags = {};
    Object.entries(flags).forEach(([key, value]) => {
      // Only include non-internal flags
      if (!key.startsWith('infra.') && !key.startsWith('security.')) {
        publicFlags[key] = value;
      }
    });
    
    res.json({
      status: 'success',
      data: publicFlags
    });
  } catch (error) {
    logger.error('Error getting feature flags', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * @route   GET /api/features/all
 * @desc    Get all feature flags including internal ones
 * @access  Private (Admin)
 */
router.get('/all', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get all feature flags
    const flags = await featureFlags.getAllFlags();
    
    res.json({
      status: 'success',
      data: flags
    });
  } catch (error) {
    logger.error('Error getting all feature flags', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * @route   GET /api/features/:key
 * @desc    Check if a specific feature is enabled
 * @access  Public
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // Get user ID if authenticated
    const userId = req.user ? req.user.id : null;
    const orgId = req.user ? req.user.orgId : null;
    
    // Check if feature is enabled
    const enabled = await featureFlags.isEnabled(key, { userId, orgId });
    
    res.json({
      status: 'success',
      data: {
        key,
        enabled
      }
    });
  } catch (error) {
    logger.error('Error checking feature flag', { 
      key: req.params.key,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * Feature flag update schema
 */
const updateFlagSchema = {
  params: schemas.idParam.params,
  body: {
    enabled: z.boolean(),
    global: z.boolean().optional(),
    userId: z.string().optional(),
    orgId: z.string().optional()
  }
};

/**
 * @route   PUT /api/features/:key
 * @desc    Update a feature flag
 * @access  Private (Admin)
 */
router.put('/:key', [
  auth, 
  roleCheck(['admin']),
  validateInput(updateFlagSchema)
], async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled, global, userId, orgId } = req.body;
    
    // Set feature flag
    const flag = await featureFlags.setFlag(key, enabled, {
      global,
      userId,
      orgId
    });
    
    res.json({
      status: 'success',
      data: flag
    });
  } catch (error) {
    logger.error('Error updating feature flag', { 
      key: req.params.key,
      body: req.body,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: error.message,
      data: null
    });
  }
});

/**
 * @route   POST /api/features/reset
 * @desc    Reset feature flags to defaults
 * @access  Private (Admin)
 */
router.post('/reset', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    const { global, userId, orgId } = req.body;
    
    // Reset feature flags
    await featureFlags.resetFlags({
      global,
      userId,
      orgId
    });
    
    res.json({
      status: 'success',
      message: 'Feature flags reset successfully',
      data: null
    });
  } catch (error) {
    logger.error('Error resetting feature flags', { 
      body: req.body,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: error.message,
      data: null
    });
  }
});

module.exports = router;
