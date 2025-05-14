/**
 * Monitoring Middleware
 * 
 * Integrates the monitoring service with Express to automatically track
 * request metrics, response times, and error rates.
 */

const monitoringService = require('../services/monitoringService');
const logger = require('../utils/logger');

/**
 * Middleware to track request metrics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function trackRequestMetrics(req, res, next) {
  // Record start time
  const startTime = Date.now();
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics before response is sent
  res.end = function(chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Call original end method
    res.end(chunk, encoding);
    
    // Track request metrics after response is sent
    try {
      monitoringService.trackRequest(req, res, startTime);
    } catch (error) {
      logger.error('Error tracking request metrics', { error: error.message });
    }
  };
  
  next();
}

/**
 * Middleware to track database queries
 * This can be used as a wrapper around database operations
 * 
 * @param {string} operation - Query operation (find, create, update, delete)
 * @param {string} model - Database model
 * @returns {Function} Middleware function
 */
function trackDatabaseQuery(operation, model) {
  return async (req, res, next) => {
    const startTime = Date.now();
    let success = true;
    
    try {
      // Execute the next middleware or route handler
      await next();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      // Track database query metrics
      try {
        const responseTime = Date.now() - startTime;
        monitoringService.trackDatabaseQuery(operation, model, responseTime, success);
      } catch (error) {
        logger.error('Error tracking database query metrics', { error: error.message });
      }
    }
  };
}

/**
 * Middleware to track AI requests
 * This can be used in AI-related routes
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function trackAIRequest(req, res, next) {
  // Record start time
  const startTime = Date.now();
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics before response is sent
  res.end = function(chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Call original end method
    res.end(chunk, encoding);
    
    // Track AI request metrics after response is sent
    try {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // Extract parameters from request
      const userId = req.user?.id;
      const personaId = req.body?.personaId || req.query?.personaId;
      const roomId = req.body?.roomId || req.query?.roomId;
      
      monitoringService.trackAIRequest(userId, personaId, roomId, responseTime, success);
    } catch (error) {
      logger.error('Error tracking AI request metrics', { error: error.message });
    }
  };
  
  next();
}

/**
 * Middleware to track journal entries
 * This can be used in journal-related routes
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function trackJournalEntry(req, res, next) {
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics before response is sent
  res.end = function(chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Call original end method
    res.end(chunk, encoding);
    
    // Only track successful journal creations
    if (req.method === 'POST' && res.statusCode < 400) {
      try {
        // Extract parameters from request
        const userId = req.user?.id;
        const personaId = req.body?.personaId;
        const roomId = req.body?.roomId;
        
        monitoringService.trackJournalEntry(userId, personaId, roomId);
      } catch (error) {
        logger.error('Error tracking journal entry metrics', { error: error.message });
      }
    }
  };
  
  next();
}

/**
 * Middleware to track new user registrations
 * This can be used in user registration routes
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function trackNewUser(req, res, next) {
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics before response is sent
  res.end = function(chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Call original end method
    res.end(chunk, encoding);
    
    // Only track successful user creations
    if (req.method === 'POST' && res.statusCode < 400) {
      try {
        // Extract user ID from response
        let userId;
        
        // Try to parse response body if it's JSON
        if (chunk) {
          try {
            const body = JSON.parse(chunk.toString());
            userId = body.data?.id || body.data?.userId || body.userId || body.id;
          } catch (e) {
            // Not JSON or couldn't parse
          }
        }
        
        // If we couldn't get userId from response, try from request
        if (!userId) {
          userId = req.body?.id || req.body?.userId;
        }
        
        if (userId) {
          monitoringService.trackNewUser(userId);
        }
      } catch (error) {
        logger.error('Error tracking new user metrics', { error: error.message });
      }
    }
  };
  
  next();
}

/**
 * Initialize monitoring middleware
 * This should be called before using any of the monitoring middleware functions
 * 
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize() {
  try {
    return await monitoringService.initialize();
  } catch (error) {
    logger.error('Error initializing monitoring middleware', { error: error.message });
    return false;
  }
}

module.exports = {
  initialize,
  trackRequestMetrics,
  trackDatabaseQuery,
  trackAIRequest,
  trackJournalEntry,
  trackNewUser
};
