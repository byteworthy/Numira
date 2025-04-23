/**
 * Disclaimer Middleware
 * 
 * Ensures users have acknowledged the non-clinical nature of the service
 * before allowing them to use AI features.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to check if user has acknowledged disclaimers
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
async function disclaimerMiddleware(req, res, next) {
  try {
    // Skip check if no authenticated user (should be caught by auth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Check if user has acknowledged disclaimers
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        id: true,
        disclaimerAccepted: true,
        disclaimerAcceptedAt: true,
        disclaimerVersion: true
      }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // If user hasn't accepted disclaimers, return error
    if (!user.disclaimerAccepted || !user.disclaimerAcceptedAt) {
      return res.status(403).json({
        status: 'error',
        message: 'You must acknowledge the service disclaimers before using this feature',
        code: 'DISCLAIMER_REQUIRED',
        data: {
          redirectTo: '/disclaimer'
        }
      });
    }

    // Check if disclaimer acceptance is expired (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    if (user.disclaimerAcceptedAt < ninetyDaysAgo) {
      return res.status(403).json({
        status: 'error',
        message: 'Your disclaimer acknowledgment has expired. Please review and acknowledge the updated terms.',
        code: 'DISCLAIMER_EXPIRED',
        data: {
          redirectTo: '/disclaimer',
          lastAccepted: user.disclaimerAcceptedAt
        }
      });
    }

    // User has acknowledged disclaimers, proceed
    next();
  } catch (error) {
    console.error('Disclaimer middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while checking disclaimer acknowledgment'
    });
  }
}

/**
 * Middleware to add disclaimer header to all API responses
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function addDisclaimerHeader(req, res, next) {
  res.setHeader('X-Numira-Disclaimer', 'This service is not a substitute for professional medical or mental health advice, diagnosis, or treatment.');
  next();
}

/**
 * Middleware to standardize response format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function standardizeResponse(req, res, next) {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(body) {
    // If the response is already in our standard format, don't modify it
    if (body && (body.status === 'success' || body.status === 'error')) {
      return originalJson.call(this, body);
    }
    
    // Otherwise, wrap it in our standard format
    const standardBody = {
      status: res.statusCode >= 400 ? 'error' : 'success',
      data: body,
      message: res.statusCode >= 400 ? 'An error occurred' : 'Request successful'
    };
    
    return originalJson.call(this, standardBody);
  };
  
  next();
}

/**
 * Middleware to add disclaimer to response body
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function addDisclaimerToResponse(req, res, next) {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(body) {
    // Add disclaimer to body if it's an AI-related endpoint
    if (req.path.includes('/ai/') && body && body.status === 'success') {
      body.disclaimer = 'This service is not a substitute for professional medical or mental health advice, diagnosis, or treatment.';
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

module.exports = {
  default: disclaimerMiddleware,
  addDisclaimerHeader,
  standardizeResponse,
  addDisclaimerToResponse
};
