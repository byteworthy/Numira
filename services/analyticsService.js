/**
 * Analytics Service
 * 
 * Provides comprehensive analytics tracking for user interactions, system performance,
 * and application usage. This service is designed to be privacy-focused and compliant
 * with data protection regulations.
 * 
 * Features:
 * - User interaction tracking (anonymized by default)
 * - Performance metrics collection
 * - Error and exception tracking
 * - Feature usage analytics
 * - Session analytics
 * - Conversion tracking
 * - Custom event tracking
 * 
 * All data collection respects user privacy settings and can be disabled globally
 * or per-user through configuration.
 */

const logger = require('../utils/logger');
const db = require('../config/db');
const config = require('../config/config');

// Constants for analytics categories
const CATEGORIES = {
  USER_INTERACTION: 'user_interaction',
  PERFORMANCE: 'performance',
  ERROR: 'error',
  FEATURE_USAGE: 'feature_usage',
  SESSION: 'session',
  CONVERSION: 'conversion',
  CUSTOM: 'custom'
};

// Constants for analytics actions
const ACTIONS = {
  // User interactions
  PAGE_VIEW: 'page_view',
  BUTTON_CLICK: 'button_click',
  FORM_SUBMIT: 'form_submit',
  NAVIGATION: 'navigation',
  
  // AI interactions
  CONVERSATION_START: 'conversation_start',
  CONVERSATION_MESSAGE: 'conversation_message',
  CONVERSATION_END: 'conversation_end',
  PERSONA_SELECT: 'persona_select',
  ROOM_SELECT: 'room_select',
  
  // Feature usage
  FEATURE_ENABLE: 'feature_enable',
  FEATURE_DISABLE: 'feature_disable',
  FEATURE_INTERACT: 'feature_interact',
  
  // Session events
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  SESSION_TIMEOUT: 'session_timeout',
  
  // Conversion events
  SIGNUP: 'signup',
  SUBSCRIPTION: 'subscription',
  UPGRADE: 'upgrade',
  DOWNGRADE: 'downgrade',
  CANCEL: 'cancel',
  
  // Error events
  ERROR_FRONTEND: 'error_frontend',
  ERROR_BACKEND: 'error_backend',
  ERROR_API: 'error_api',
  
  // Performance events
  PERFORMANCE_API: 'performance_api',
  PERFORMANCE_PAGE_LOAD: 'performance_page_load',
  PERFORMANCE_RESOURCE: 'performance_resource'
};

/**
 * Track an analytics event
 * 
 * @param {String} category - The category of the event (use CATEGORIES constants)
 * @param {String} action - The action that occurred (use ACTIONS constants)
 * @param {Object} data - Additional data about the event
 * @param {Object} user - User information (will be anonymized based on settings)
 * @param {Object} options - Additional options for tracking
 * @returns {Promise<Object>} - The tracked event
 */
const trackEvent = async (category, action, data = {}, user = {}, options = {}) => {
  try {
    // Check if analytics is enabled
    if (!config.ANALYTICS_ENABLED) {
      return { tracked: false, reason: 'Analytics disabled globally' };
    }
    
    // Check if user has opted out of analytics
    if (user && user.analyticsOptOut) {
      return { tracked: false, reason: 'User opted out of analytics' };
    }
    
    // Anonymize user data based on privacy settings
    const anonymizedUser = anonymizeUserData(user);
    
    // Prepare event data
    const event = {
      category,
      action,
      timestamp: new Date().toISOString(),
      data: sanitizeData(data),
      user: anonymizedUser,
      session: options.sessionId || null,
      environment: process.env.NODE_ENV || 'development',
      client: {
        type: options.clientType || 'unknown',
        version: options.clientVersion || 'unknown',
        os: options.os || 'unknown',
        device: options.device || 'unknown'
      }
    };
    
    // Store event in database
    const result = await storeEvent(event);
    
    // Log event for debugging in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Analytics event tracked', { category, action });
    }
    
    return { tracked: true, event, result };
  } catch (error) {
    logger.error('Error tracking analytics event', { category, action, error: error.message });
    return { tracked: false, reason: 'Error tracking event', error: error.message };
  }
};

/**
 * Track a page view
 * 
 * @param {String} page - The page that was viewed
 * @param {Object} user - User information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The tracked event
 */
const trackPageView = async (page, user = {}, options = {}) => {
  return trackEvent(
    CATEGORIES.USER_INTERACTION,
    ACTIONS.PAGE_VIEW,
    { page, referrer: options.referrer || null },
    user,
    options
  );
};

/**
 * Track an API performance metric
 * 
 * @param {String} endpoint - The API endpoint
 * @param {Number} responseTime - The response time in milliseconds
 * @param {Number} statusCode - The HTTP status code
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The tracked event
 */
const trackApiPerformance = async (endpoint, responseTime, statusCode, options = {}) => {
  return trackEvent(
    CATEGORIES.PERFORMANCE,
    ACTIONS.PERFORMANCE_API,
    { 
      endpoint, 
      responseTime, 
      statusCode,
      method: options.method || 'GET'
    },
    {},
    options
  );
};

/**
 * Track a feature usage event
 * 
 * @param {String} feature - The feature that was used
 * @param {String} action - The action that was taken
 * @param {Object} user - User information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The tracked event
 */
const trackFeatureUsage = async (feature, action, user = {}, options = {}) => {
  return trackEvent(
    CATEGORIES.FEATURE_USAGE,
    action,
    { feature, details: options.details || null },
    user,
    options
  );
};

/**
 * Track an error event
 * 
 * @param {String} errorType - The type of error
 * @param {String} message - The error message
 * @param {Object} details - Additional error details
 * @param {Object} user - User information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The tracked event
 */
const trackError = async (errorType, message, details = {}, user = {}, options = {}) => {
  // Sanitize error details to remove sensitive information
  const sanitizedDetails = sanitizeErrorDetails(details);
  
  return trackEvent(
    CATEGORIES.ERROR,
    errorType,
    { 
      message, 
      details: sanitizedDetails,
      stack: options.includeStack ? sanitizedDetails.stack : null,
      url: options.url || null
    },
    user,
    options
  );
};

/**
 * Track a conversation event
 * 
 * @param {String} action - The conversation action (start, message, end)
 * @param {String} conversationId - The conversation ID
 * @param {Object} details - Additional conversation details
 * @param {Object} user - User information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The tracked event
 */
const trackConversation = async (action, conversationId, details = {}, user = {}, options = {}) => {
  // Don't track the actual message content for privacy reasons
  // unless explicitly configured to do so and user has consented
  const trackContent = config.ANALYTICS_TRACK_CONTENT && 
                      (user.contentTrackingConsent || false);
  
  const conversationDetails = {
    conversationId,
    persona: details.persona || null,
    room: details.room || null,
    messageCount: details.messageCount || 0,
    duration: details.duration || null,
    // Only include content if tracking is enabled and user has consented
    content: trackContent ? details.content : null
  };
  
  return trackEvent(
    CATEGORIES.USER_INTERACTION,
    action,
    conversationDetails,
    user,
    options
  );
};

/**
 * Get analytics data for a specific period and filters
 * 
 * @param {String} startDate - The start date (ISO string)
 * @param {String} endDate - The end date (ISO string)
 * @param {Object} filters - Filters to apply to the data
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The analytics data
 */
const getAnalyticsData = async (startDate, endDate, filters = {}, options = {}) => {
  try {
    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date range');
    }
    
    // Build query based on filters
    const query = {
      text: `
        SELECT * FROM analytics_events
        WHERE timestamp >= $1 AND timestamp <= $2
        ${filters.category ? 'AND category = $3' : ''}
        ${filters.action ? `AND action = $${filters.category ? 4 : 3}` : ''}
        ORDER BY timestamp DESC
        ${options.limit ? `LIMIT $${getParamIndex(filters, options)}` : ''}
      `,
      values: [
        start.toISOString(),
        end.toISOString(),
        ...(filters.category ? [filters.category] : []),
        ...(filters.action ? [filters.action] : []),
        ...(options.limit ? [options.limit] : [])
      ]
    };
    
    // Execute query
    const result = await db.query(query);
    
    return {
      success: true,
      data: result.rows,
      count: result.rowCount,
      period: { startDate, endDate }
    };
  } catch (error) {
    logger.error('Error retrieving analytics data', { error: error.message });
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Get aggregated analytics metrics
 * 
 * @param {String} metric - The metric to aggregate
 * @param {String} startDate - The start date (ISO string)
 * @param {String} endDate - The end date (ISO string)
 * @param {Object} filters - Filters to apply to the data
 * @returns {Promise<Object>} - The aggregated metrics
 */
const getAggregatedMetrics = async (metric, startDate, endDate, filters = {}) => {
  try {
    // Define available metrics and their SQL aggregations
    const availableMetrics = {
      'total_users': 'COUNT(DISTINCT user_id)',
      'total_sessions': 'COUNT(DISTINCT session_id)',
      'avg_session_duration': 'AVG(session_duration)',
      'total_conversations': 'COUNT(DISTINCT conversation_id)',
      'avg_messages_per_conversation': 'AVG(message_count)',
      'error_rate': 'SUM(CASE WHEN category = \'error\' THEN 1 ELSE 0 END) / COUNT(*) * 100',
      'conversion_rate': 'SUM(CASE WHEN action = \'signup\' OR action = \'subscription\' THEN 1 ELSE 0 END) / COUNT(DISTINCT user_id) * 100'
    };
    
    // Validate metric
    if (!availableMetrics[metric]) {
      throw new Error(`Invalid metric: ${metric}`);
    }
    
    // Build query based on metric and filters
    const query = {
      text: `
        SELECT ${availableMetrics[metric]} as value
        FROM analytics_events
        WHERE timestamp >= $1 AND timestamp <= $2
        ${filters.category ? 'AND category = $3' : ''}
        ${filters.action ? `AND action = $${filters.category ? 4 : 3}` : ''}
      `,
      values: [
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
        ...(filters.category ? [filters.category] : []),
        ...(filters.action ? [filters.action] : [])
      ]
    };
    
    // Execute query
    const result = await db.query(query);
    
    return {
      success: true,
      metric,
      value: result.rows[0]?.value || 0,
      period: { startDate, endDate }
    };
  } catch (error) {
    logger.error('Error retrieving aggregated metrics', { metric, error: error.message });
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Store an analytics event in the database
 * 
 * @param {Object} event - The event to store
 * @returns {Promise<Object>} - The stored event
 */
const storeEvent = async (event) => {
  try {
    // Convert event object to JSON for storage
    const eventJson = JSON.stringify(event);
    
    // Insert event into database
    const query = {
      text: `
        INSERT INTO analytics_events
        (category, action, timestamp, data, user_id, session_id, environment)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      values: [
        event.category,
        event.action,
        event.timestamp,
        eventJson,
        event.user?.id || null,
        event.session || null,
        event.environment
      ]
    };
    
    const result = await db.query(query);
    
    return {
      success: true,
      id: result.rows[0].id
    };
  } catch (error) {
    logger.error('Error storing analytics event', { error: error.message });
    
    // Fallback to in-memory storage if database fails
    if (config.ANALYTICS_FALLBACK_TO_MEMORY) {
      storeEventInMemory(event);
      return { success: true, fallback: true };
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// In-memory storage for analytics events when database is unavailable
const inMemoryEvents = [];

/**
 * Store an analytics event in memory (fallback)
 * 
 * @param {Object} event - The event to store
 */
const storeEventInMemory = (event) => {
  // Limit the number of events stored in memory
  if (inMemoryEvents.length >= 1000) {
    inMemoryEvents.shift(); // Remove oldest event
  }
  
  inMemoryEvents.push(event);
  
  // Log warning about using in-memory storage
  logger.warn('Using in-memory storage for analytics event', { 
    category: event.category, 
    action: event.action 
  });
};

/**
 * Flush in-memory events to the database
 * 
 * @returns {Promise<Object>} - The result of the flush operation
 */
const flushInMemoryEvents = async () => {
  if (inMemoryEvents.length === 0) {
    return { success: true, flushed: 0 };
  }
  
  try {
    let flushedCount = 0;
    
    // Process events in batches
    const batchSize = 100;
    for (let i = 0; i < inMemoryEvents.length; i += batchSize) {
      const batch = inMemoryEvents.slice(i, i + batchSize);
      
      // Create a multi-row insert query
      const valueStrings = [];
      const valueParams = [];
      let paramIndex = 1;
      
      batch.forEach(event => {
        valueStrings.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);
        valueParams.push(
          event.category,
          event.action,
          event.timestamp,
          JSON.stringify(event),
          event.user?.id || null,
          event.session || null,
          event.environment
        );
        paramIndex += 7;
      });
      
      const query = {
        text: `
          INSERT INTO analytics_events
          (category, action, timestamp, data, user_id, session_id, environment)
          VALUES ${valueStrings.join(', ')}
        `,
        values: valueParams
      };
      
      await db.query(query);
      flushedCount += batch.length;
    }
    
    // Clear in-memory events
    inMemoryEvents.length = 0;
    
    return { 
      success: true, 
      flushed: flushedCount 
    };
  } catch (error) {
    logger.error('Error flushing in-memory analytics events', { error: error.message });
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Anonymize user data for privacy
 * 
 * @param {Object} user - The user data to anonymize
 * @returns {Object} - Anonymized user data
 */
const anonymizeUserData = (user) => {
  if (!user) return null;
  
  // Return only non-sensitive user information
  return {
    id: user.id, // Keep ID for aggregation
    role: user.role || 'user',
    createdAt: user.createdAt,
    preferences: {
      theme: user.preferences?.theme,
      language: user.preferences?.language
    },
    // Add a hash of the IP for geographic aggregation without storing the actual IP
    ipHash: user.ip ? hashIp(user.ip) : null
  };
};

/**
 * Hash an IP address for anonymization
 * 
 * @param {String} ip - The IP address to hash
 * @returns {String} - Hashed IP
 */
const hashIp = (ip) => {
  // Simple hash function for demo purposes
  // In production, use a proper cryptographic hash
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(ip + config.IP_HASH_SALT)
    .digest('hex')
    .substring(0, 16); // Truncate to reduce uniqueness
};

/**
 * Sanitize data to remove sensitive information
 * 
 * @param {Object} data - The data to sanitize
 * @returns {Object} - Sanitized data
 */
const sanitizeData = (data) => {
  if (!data) return {};
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'token', 'secret', 'credit_card', 'ssn', 'social_security',
    'address', 'phone', 'email', 'dob', 'birth', 'license'
  ];
  
  // Recursively sanitize objects
  Object.keys(sanitized).forEach(key => {
    // Check if the key contains a sensitive field name
    const isSensitive = sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });
  
  return sanitized;
};

/**
 * Sanitize error details to remove sensitive information
 * 
 * @param {Object} details - The error details to sanitize
 * @returns {Object} - Sanitized error details
 */
const sanitizeErrorDetails = (details) => {
  if (!details) return {};
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...details };
  
  // Sanitize stack trace to remove file paths
  if (sanitized.stack) {
    sanitized.stack = sanitized.stack
      .split('\n')
      .map(line => {
        // Remove full file paths from stack traces
        return line.replace(/\(([^:]+):[^:]+:[^:]+\)/, '([FILEPATH])');
      })
      .join('\n');
  }
  
  // Sanitize request/response data
  if (sanitized.request) {
    sanitized.request = sanitizeData(sanitized.request);
  }
  
  if (sanitized.response) {
    sanitized.response = sanitizeData(sanitized.response);
  }
  
  return sanitizeData(sanitized);
};

/**
 * Helper function to get the parameter index for SQL queries
 */
const getParamIndex = (filters, options) => {
  let index = 3; // Start with 3 (after startDate and endDate)
  if (filters.category) index++;
  if (filters.action) index++;
  return index;
};

module.exports = {
  // Event tracking
  trackEvent,
  trackPageView,
  trackApiPerformance,
  trackFeatureUsage,
  trackError,
  trackConversation,
  
  // Data retrieval
  getAnalyticsData,
  getAggregatedMetrics,
  
  // Memory management
  flushInMemoryEvents,
  
  // Constants
  CATEGORIES,
  ACTIONS
};
