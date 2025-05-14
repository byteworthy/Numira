/**
 * Analytics Routes
 * 
 * Provides API endpoints for tracking and retrieving analytics data.
 * These endpoints are secured and require appropriate authentication and authorization.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const analyticsService = require('../../services/analyticsService');
const logger = require('../../utils/logger');

/**
 * Validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST api/analytics/event
 * @desc    Track a custom analytics event
 * @access  Private
 */
router.post(
  '/event',
  [
    auth,
    [
      check('category', 'Category is required').not().isEmpty(),
      check('action', 'Action is required').not().isEmpty()
    ],
    validateRequest
  ],
  async (req, res) => {
    try {
      const { category, action, data } = req.body;
      
      // Get client information from request
      const clientInfo = {
        clientType: req.get('X-Client-Type') || 'unknown',
        clientVersion: req.get('X-Client-Version') || 'unknown',
        os: req.get('X-Client-OS') || 'unknown',
        device: req.get('X-Client-Device') || 'unknown',
        sessionId: req.get('X-Session-ID') || null
      };
      
      // Track the event
      const result = await analyticsService.trackEvent(
        category,
        action,
        data || {},
        req.user,
        clientInfo
      );
      
      if (!result.tracked) {
        return res.status(400).json({
          success: false,
          message: 'Failed to track event',
          reason: result.reason
        });
      }
      
      res.json({
        success: true,
        message: 'Event tracked successfully'
      });
    } catch (error) {
      logger.error('Error in analytics event tracking', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   POST api/analytics/page-view
 * @desc    Track a page view
 * @access  Private
 */
router.post(
  '/page-view',
  [
    auth,
    [
      check('page', 'Page is required').not().isEmpty()
    ],
    validateRequest
  ],
  async (req, res) => {
    try {
      const { page, referrer } = req.body;
      
      // Get client information from request
      const clientInfo = {
        clientType: req.get('X-Client-Type') || 'unknown',
        clientVersion: req.get('X-Client-Version') || 'unknown',
        os: req.get('X-Client-OS') || 'unknown',
        device: req.get('X-Client-Device') || 'unknown',
        sessionId: req.get('X-Session-ID') || null,
        referrer
      };
      
      // Track the page view
      const result = await analyticsService.trackPageView(
        page,
        req.user,
        clientInfo
      );
      
      if (!result.tracked) {
        return res.status(400).json({
          success: false,
          message: 'Failed to track page view',
          reason: result.reason
        });
      }
      
      res.json({
        success: true,
        message: 'Page view tracked successfully'
      });
    } catch (error) {
      logger.error('Error in page view tracking', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   POST api/analytics/error
 * @desc    Track an error
 * @access  Private
 */
router.post(
  '/error',
  [
    auth,
    [
      check('errorType', 'Error type is required').not().isEmpty(),
      check('message', 'Error message is required').not().isEmpty()
    ],
    validateRequest
  ],
  async (req, res) => {
    try {
      const { errorType, message, details, url } = req.body;
      
      // Get client information from request
      const clientInfo = {
        clientType: req.get('X-Client-Type') || 'unknown',
        clientVersion: req.get('X-Client-Version') || 'unknown',
        os: req.get('X-Client-OS') || 'unknown',
        device: req.get('X-Client-Device') || 'unknown',
        sessionId: req.get('X-Session-ID') || null,
        url,
        includeStack: process.env.NODE_ENV !== 'production'
      };
      
      // Track the error
      const result = await analyticsService.trackError(
        errorType,
        message,
        details || {},
        req.user,
        clientInfo
      );
      
      if (!result.tracked) {
        return res.status(400).json({
          success: false,
          message: 'Failed to track error',
          reason: result.reason
        });
      }
      
      res.json({
        success: true,
        message: 'Error tracked successfully'
      });
    } catch (error) {
      logger.error('Error in error tracking', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   POST api/analytics/conversation
 * @desc    Track a conversation event
 * @access  Private
 */
router.post(
  '/conversation',
  [
    auth,
    [
      check('action', 'Action is required').not().isEmpty(),
      check('conversationId', 'Conversation ID is required').not().isEmpty()
    ],
    validateRequest
  ],
  async (req, res) => {
    try {
      const { action, conversationId, details } = req.body;
      
      // Get client information from request
      const clientInfo = {
        clientType: req.get('X-Client-Type') || 'unknown',
        clientVersion: req.get('X-Client-Version') || 'unknown',
        os: req.get('X-Client-OS') || 'unknown',
        device: req.get('X-Client-Device') || 'unknown',
        sessionId: req.get('X-Session-ID') || null
      };
      
      // Track the conversation event
      const result = await analyticsService.trackConversation(
        action,
        conversationId,
        details || {},
        req.user,
        clientInfo
      );
      
      if (!result.tracked) {
        return res.status(400).json({
          success: false,
          message: 'Failed to track conversation event',
          reason: result.reason
        });
      }
      
      res.json({
        success: true,
        message: 'Conversation event tracked successfully'
      });
    } catch (error) {
      logger.error('Error in conversation tracking', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   GET api/analytics/data
 * @desc    Get analytics data
 * @access  Admin
 */
router.get(
  '/data',
  [auth, roleCheck('admin')],
  async (req, res) => {
    try {
      const { startDate, endDate, category, action, limit } = req.query;
      
      // Validate date range
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      // Get analytics data
      const result = await analyticsService.getAnalyticsData(
        startDate,
        endDate,
        { category, action },
        { limit: limit ? parseInt(limit) : null }
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to retrieve analytics data',
          error: result.error
        });
      }
      
      res.json({
        success: true,
        data: result.data,
        count: result.count,
        period: result.period
      });
    } catch (error) {
      logger.error('Error retrieving analytics data', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   GET api/analytics/metrics/:metric
 * @desc    Get aggregated analytics metrics
 * @access  Admin
 */
router.get(
  '/metrics/:metric',
  [auth, roleCheck('admin')],
  async (req, res) => {
    try {
      const { metric } = req.params;
      const { startDate, endDate, category, action } = req.query;
      
      // Validate date range
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      // Get aggregated metrics
      const result = await analyticsService.getAggregatedMetrics(
        metric,
        startDate,
        endDate,
        { category, action }
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to retrieve metrics',
          error: result.error
        });
      }
      
      res.json({
        success: true,
        metric: result.metric,
        value: result.value,
        period: result.period
      });
    } catch (error) {
      logger.error('Error retrieving analytics metrics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

/**
 * @route   POST api/analytics/flush
 * @desc    Flush in-memory analytics events to the database
 * @access  Admin
 */
router.post(
  '/flush',
  [auth, roleCheck('admin')],
  async (req, res) => {
    try {
      // Flush in-memory events
      const result = await analyticsService.flushInMemoryEvents();
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to flush in-memory events',
          error: result.error
        });
      }
      
      res.json({
        success: true,
        message: `Successfully flushed ${result.flushed} events`
      });
    } catch (error) {
      logger.error('Error flushing in-memory events', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
);

module.exports = router;
