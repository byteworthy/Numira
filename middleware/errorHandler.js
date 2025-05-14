/**
 * Global Error Handler Middleware
 * 
 * Standardizes error responses across the API for consistent
 * mobile client handling.
 */

const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  // Log the error
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user ? req.user.id : 'unauthenticated'
  });

  // Set default status code and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors || null;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errors = err.errors;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) { // MongoDB duplicate key
    statusCode = 409;
    message = 'Duplicate resource';
  }

  // Send standardized error response
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    // Include stack trace in development mode only
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
