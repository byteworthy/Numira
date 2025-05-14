/**
 * Health Check Routes
 * 
 * Provides endpoints for checking API health status.
 * These endpoints are critical for mobile apps to verify connectivity.
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');

/**
 * @route   GET api/health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @route   GET api/health/db
 * @desc    Database connection health check
 * @access  Public
 */
router.get('/db', async (req, res) => {
  try {
    // Test database connection
    const result = await db.query('SELECT NOW()');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      dbTimestamp: result.rows[0].now
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'production' ? 'Database error' : err.message
    });
  }
});

/**
 * @route   GET api/health/detailed
 * @desc    Detailed system health check
 * @access  Public
 */
router.get('/detailed', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await db.query('SELECT NOW()');
    
    // Get system info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    res.json({
      success: true,
      message: 'System health check successful',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        timestamp: dbResult.rows[0].now
      },
      system: systemInfo,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'System health check failed',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: process.env.NODE_ENV === 'production' ? 'Database error' : err.message
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime()
      },
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

module.exports = router;
