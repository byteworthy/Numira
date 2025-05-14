/**
 * Input Validation Utility
 * 
 * Provides robust input validation for Express routes.
 * Uses express-validator for schema validation and sanitization.
 * 
 * @module validateInput
 */

const { validationResult, body, query, param } = require('express-validator');
const logger = require('./logger');
const xss = require('xss');

/**
 * Middleware to validate request inputs based on provided schema
 * 
 * @param {Array} validations - Array of express-validator validation chains
 * @returns {Function} Express middleware function
 */
function validate(validations) {
  return async (req, res, next) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Input validation failed', {
        path: req.path,
        method: req.method,
        errors: errors.array()
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request parameters',
        errors: errors.array()
      });
    }

    // Continue to the next middleware or route handler
    next();
  };
}

/**
 * Sanitize a string to prevent XSS attacks
 * 
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Apply XSS filtering
  return xss(input.trim());
}

/**
 * Common validation schemas for reuse across routes
 */
const schemas = {
  // User-related validations
  user: {
    email: body('email')
      .isEmail().withMessage('Must be a valid email address')
      .normalizeEmail()
      .trim(),
    
    password: body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character'),
    
    userId: param('userId')
      .isUUID(4).withMessage('User ID must be a valid UUID')
  },
  
  // Pagination parameters
  pagination: {
    limit: query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt(),
    
    offset: query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
      .toInt(),
    
    sortBy: query('sortBy')
      .optional()
      .isString()
      .trim()
      .escape(),
    
    sortOrder: query('sortOrder')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Sort order must be either "asc" or "desc"')
  },
  
  // Date range parameters
  dateRange: {
    startDate: query('startDate')
      .optional()
      .isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    
    endDate: query('endDate')
      .optional()
      .isISO8601().withMessage('End date must be a valid ISO 8601 date')
  },
  
  // AI-related validations
  ai: {
    userInput: body('userInput')
      .isString().withMessage('User input must be a string')
      .trim()
      .isLength({ min: 1, max: 1000 }).withMessage('User input must be between 1 and 1000 characters'),
    
    personaId: body('personaId')
      .isString().withMessage('Persona ID must be a string')
      .trim()
      .isLength({ min: 1 }).withMessage('Persona ID is required'),
    
    roomId: body('roomId')
      .isString().withMessage('Room ID must be a string')
      .trim()
      .isLength({ min: 1 }).withMessage('Room ID is required')
  },
  
  // Journal-related validations
  journal: {
    journalId: param('journalId')
      .isUUID(4).withMessage('Journal ID must be a valid UUID'),
    
    prompt: body('prompt')
      .isString().withMessage('Prompt must be a string')
      .trim()
      .isLength({ min: 1, max: 1000 }).withMessage('Prompt must be between 1 and 1000 characters'),
    
    response: body('response')
      .isString().withMessage('Response must be a string')
      .trim()
      .isLength({ min: 1 }).withMessage('Response is required')
  }
};

/**
 * Security headers middleware
 * Adds security-related HTTP headers to responses
 */
function securityHeaders(req, res, next) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline';");
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
}

/**
 * Sanitize request body middleware
 * Recursively sanitizes all string values in the request body
 */
function sanitizeBody(req, res, next) {
  if (req.body) {
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        if (typeof value === 'string') {
          obj[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitizeObject(value);
        }
      });
      
      return obj;
    };
    
    req.body = sanitizeObject(req.body);
  }
  
  next();
}

module.exports = {
  validate,
  schemas,
  sanitizeString,
  securityHeaders,
  sanitizeBody
};
