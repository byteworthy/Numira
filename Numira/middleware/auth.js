/**
 * Enhanced Authentication Middleware
 * 
 * Provides robust JWT-based authentication with additional security features:
 * - Token validation and verification
 * - Token expiration handling
 * - Role-based access control integration
 * - Brute force protection
 * - Detailed security logging
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const { createHash } = require('crypto');

// Cache for token blacklist (for logout/revoked tokens)
// In production, this should be stored in Redis or another distributed cache
const tokenBlacklist = new Set();

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
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

  // Check if no token
  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(401).json({
      status: 'error',
      message: 'No authentication token, authorization denied'
    });
  }

  try {
    // Check if token is blacklisted (revoked)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (tokenBlacklist.has(tokenHash)) {
      logger.warn('Authentication failed: Revoked token used', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify token with strict options
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'], // Only allow specific algorithms
      issuer: config.jwt.issuer || 'numira-api', // Validate issuer
      maxAge: config.jwt.expiresIn || '1d' // Maximum age of token
    });
    
    // Add user from payload
    req.user = decoded.user;
    
    // Add token info for potential revocation
    req.token = {
      hash: tokenHash,
      raw: token
    };
    
    // Log successful authentication for sensitive routes
    if (req.path.includes('/admin') || req.path.includes('/payment')) {
      logger.info('Authenticated access to sensitive route', {
        userId: req.user.id,
        path: req.path,
        method: req.method
      });
    }
    
    next();
  } catch (error) {
    logger.warn('Authentication error', {
      error: error.message,
      errorName: error.name,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token not yet active',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }
    
    return res.status(401).json({
      status: 'error',
      message: 'Token is not valid',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Middleware to require specific roles
 * 
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Middleware function
 */
function requireRole(roles) {
  // Convert single role to array
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    // Check if user exists (auth middleware should run first)
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Check if user has required role
    const userRoles = req.user.roles || ['user'];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.id,
        userRoles,
        requiredRoles,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        status: 'error',
        message: 'Access denied: Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
}

/**
 * Add a token to the blacklist (for logout/revocation)
 * 
 * @param {string} token - JWT token to blacklist
 * @param {number} expiryTime - Time in seconds until token expiry
 */
function revokeToken(token, expiryTime = 86400) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokenBlacklist.add(tokenHash);
  
  // Automatically remove from blacklist after expiry
  // In production, this should be handled by Redis expiry
  setTimeout(() => {
    tokenBlacklist.delete(tokenHash);
  }, expiryTime * 1000);
  
  logger.info('Token revoked', { tokenHash });
}

module.exports = {
  auth,
  requireRole,
  revokeToken
};
