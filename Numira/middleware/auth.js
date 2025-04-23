/**
 * Authentication Middleware
 * 
 * Verifies user authentication via JWT tokens.
 * This is a simplified version for demonstration purposes.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware to verify JWT token and set user in request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function auth(req, res, next) {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'No authentication token, authorization denied'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Add user from payload
    req.user = decoded.user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      status: 'error',
      message: 'Token is not valid',
      code: 'INVALID_TOKEN'
    });
  }
}

module.exports = auth;
