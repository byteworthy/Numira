/**
 * Disclaimer API Routes
 * 
 * Provides endpoints for retrieving and acknowledging disclaimers.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const { 
  getDisclaimerText, 
  checkDisclaimerStatus, 
  acknowledgeDisclaimer 
} = require('../../services/disclaimerService');

/**
 * @route   GET /api/disclaimer
 * @desc    Get the current disclaimer text
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const disclaimer = await getDisclaimerText();
    
    return res.json({
      status: 'success',
      data: disclaimer,
      message: 'Disclaimer retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving disclaimer:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve disclaimer',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/disclaimer/status
 * @desc    Check if the authenticated user has acknowledged the disclaimer
 * @access  Private
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = await checkDisclaimerStatus(req.user.id);
    
    return res.json({
      status: 'success',
      data: status,
      message: 'Disclaimer status retrieved successfully'
    });
  } catch (error) {
    console.error('Error checking disclaimer status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check disclaimer status',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/disclaimer/acknowledge
 * @desc    Acknowledge the disclaimer
 * @access  Private
 */
router.post('/acknowledge', [
  auth,
  check('version').optional().trim().escape()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { version } = req.body;
    
    // Record the acknowledgment
    const result = await acknowledgeDisclaimer(req.user.id, version);
    
    return res.json({
      status: 'success',
      data: {
        userId: result.id,
        disclaimerAccepted: result.disclaimerAccepted,
        disclaimerAcceptedAt: result.disclaimerAcceptedAt,
        disclaimerVersion: result.disclaimerVersion
      },
      message: 'Disclaimer acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging disclaimer:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to acknowledge disclaimer',
      error: error.message
    });
  }
});

module.exports = router;
