/**
 * Data Sanitization Middleware
 * 
 * Protects against XSS attacks and other injection vulnerabilities by sanitizing
 * request data. This middleware is a critical security layer that ensures all
 * incoming data is cleaned before processing.
 * 
 * Part of Numira's ethical commitment to user safety and data protection.
 */

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Recursively sanitizes an object by cleaning all string values
 * @param {Object|Array|String} data - The data to sanitize
 * @returns {Object|Array|String} - The sanitized data
 */
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    // Sanitize string values to prevent XSS
    return DOMPurify.sanitize(data, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No HTML attributes allowed
      FORBID_CONTENTS: true, // Disallow potentially dangerous content
      SAFE_FOR_TEMPLATES: true // Extra safety for template systems
    }).trim();
  }
  
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      // Recursively sanitize arrays
      return data.map(item => sanitizeData(item));
    }
    
    // Recursively sanitize objects
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sanitizing special fields like passwords (which should be hashed, not sanitized)
      if (key === 'password' || key === 'passwordConfirmation') {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  // Return non-string, non-object values as is
  return data;
};

/**
 * Express middleware to sanitize request body, query parameters, and URL parameters
 */
module.exports = (req, res, next) => {
  // Skip sanitization for specific routes if needed
  const skipRoutes = [
    '/api/health',
    '/api/health/db',
    '/api/health/detailed'
  ];
  
  if (skipRoutes.includes(req.path)) {
    return next();
  }
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeData(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeData(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeData(req.params);
  }
  
  next();
};
