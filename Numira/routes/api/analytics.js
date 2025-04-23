/**
 * Analytics API Routes
 * 
 * Provides endpoints for retrieving analytics data about user interactions,
 * AI usage, and system performance metrics.
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../../services/analyticsService');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const { validateInput } = require('../../utils/validateInput');
const { check, query, validationResult } = require('express-validator');

/**
 * @route   GET /api/analytics/personas
 * @desc    Get persona usage statistics
 * @access  Admin only
 */
router.get('/personas', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get persona stats
    const personaStats = await analyticsService.getPersonaStats({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: personaStats,
      message: 'Persona usage statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/personas:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving persona statistics'
    });
  }
});

/**
 * @route   GET /api/analytics/rooms
 * @desc    Get room usage statistics
 * @access  Admin only
 */
router.get('/rooms', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get room stats
    const roomStats = await analyticsService.getRoomStats({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: roomStats,
      message: 'Room usage statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/rooms:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving room statistics'
    });
  }
});

/**
 * @route   GET /api/analytics/combinations
 * @desc    Get persona-room combination usage statistics
 * @access  Admin only
 */
router.get('/combinations', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get combination stats
    const combinationStats = await analyticsService.getCombinationStats({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: combinationStats,
      message: 'Persona-room combination statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/combinations:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving combination statistics'
    });
  }
});

/**
 * @route   GET /api/analytics/ai
 * @desc    Get AI usage statistics
 * @access  Admin only
 */
router.get('/ai', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get AI stats
    const aiStats = await analyticsService.getAIStats({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: aiStats,
      message: 'AI usage statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/ai:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving AI statistics'
    });
  }
});

/**
 * @route   GET /api/analytics/users
 * @desc    Get user engagement statistics
 * @access  Admin only
 */
router.get('/users', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get user stats
    const userStats = await analyticsService.getUserStats({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: userStats,
      message: 'User engagement statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/users:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving user statistics'
    });
  }
});

/**
 * @route   GET /api/analytics/summary
 * @desc    Get summary of all analytics
 * @access  Admin only
 */
router.get('/summary', [
  auth,
  roleCheck('admin'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Parse dates if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get summary
    const summary = await analyticsService.getSummary({ startDate, endDate });
    
    return res.json({
      status: 'success',
      data: summary,
      message: 'Analytics summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/summary:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving analytics summary'
    });
  }
});

/**
 * @route   POST /api/analytics/cleanup
 * @desc    Clean up old analytics data
 * @access  Admin only
 */
router.post('/cleanup', [
  auth,
  roleCheck('admin'),
  check('retentionDays').optional().isInt({ min: 30, max: 365 }).withMessage('Retention days must be between 30 and 365')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array(),
        message: 'Invalid request parameters'
      });
    }
    
    // Get retention days from request body or use default (90 days)
    const retentionDays = req.body.retentionDays || 90;
    
    // Clean up old analytics data
    const result = await analyticsService.cleanupOldAnalyticsData(retentionDays);
    
    if (result.success) {
      return res.json({
        status: 'success',
        data: {
          deletedAnalytics: result.deletedAnalytics,
          deletedAIMetrics: result.deletedAIMetrics
        },
        message: `Successfully cleaned up analytics data older than ${retentionDays} days`
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: `Failed to clean up analytics data: ${result.error}`
      });
    }
  } catch (error) {
    console.error('Error in POST /api/analytics/cleanup:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while cleaning up analytics data'
    });
  }
});

module.exports = router;
