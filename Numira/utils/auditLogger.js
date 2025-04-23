/**
 * Audit Logger
 * 
 * Logs security-relevant events to a dedicated audit log for compliance and security monitoring.
 * Events are stored in a database table and optionally in a separate log file.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger for audit logs
const auditFileLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'audit' },
  transports: [
    // Write to audit log file with daily rotation
    new winston.transports.File({
      filename: path.join(logsDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  auditFileLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Event types for audit logging
 */
const EVENT_TYPES = {
  // Authentication events
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGE: 'auth.password.change',
  PASSWORD_RESET_REQUEST: 'auth.password.reset.request',
  PASSWORD_RESET_COMPLETE: 'auth.password.reset.complete',
  MFA_ENABLED: 'auth.mfa.enabled',
  MFA_DISABLED: 'auth.mfa.disabled',
  MFA_CHALLENGE: 'auth.mfa.challenge',
  
  // Account events
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_DELETION_REQUESTED: 'account.deletion.requested',
  ACCOUNT_DELETION_CANCELLED: 'account.deletion.cancelled',
  ACCOUNT_DELETED: 'account.deleted',
  
  // Session events
  SESSION_CREATED: 'session.created',
  SESSION_EXPIRED: 'session.expired',
  SESSION_REVOKED: 'session.revoked',
  
  // Data access events
  DATA_EXPORT: 'data.export',
  DATA_IMPORT: 'data.import',
  
  // AI events
  AI_PROMPT: 'ai.prompt',
  AI_RESPONSE: 'ai.response',
  AI_ERROR: 'ai.error',
  
  // Admin events
  ADMIN_ACTION: 'admin.action',
  SYSTEM_CONFIG_CHANGE: 'system.config.change',
  
  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILURE: 'payment.failure',
  
  // Family plan events
  FAMILY_CREATED: 'family.created',
  FAMILY_UPDATED: 'family.updated',
  FAMILY_MEMBER_ADDED: 'family.member.added',
  FAMILY_MEMBER_REMOVED: 'family.member.removed',
  
  // API events
  API_KEY_CREATED: 'api.key.created',
  API_KEY_REVOKED: 'api.key.revoked',
  API_RATE_LIMIT_EXCEEDED: 'api.rate_limit.exceeded'
};

/**
 * Sensitivity levels for audit events
 */
const SENSITIVITY_LEVELS = {
  PUBLIC: 'public',      // No sensitive data, can be freely shared
  INTERNAL: 'internal',  // Internal business data, limited sharing
  SENSITIVE: 'sensitive', // Contains PII or sensitive business data
  CRITICAL: 'critical'   // Highly sensitive security events
};

/**
 * Log an audit event
 * 
 * @param {string} eventType - Type of event from EVENT_TYPES
 * @param {Object} data - Event data
 * @param {string} data.userId - User ID (if applicable)
 * @param {string} data.orgId - Organization ID (if applicable)
 * @param {string} data.ip - IP address
 * @param {string} data.userAgent - User agent
 * @param {Object} data.metadata - Additional event metadata
 * @param {string} data.sensitivity - Sensitivity level from SENSITIVITY_LEVELS
 * @param {string} data.outcome - Outcome of the event (success, failure, etc.)
 * @returns {Promise<Object>} - Created audit log entry
 */
async function logAuditEvent(eventType, data) {
  try {
    const {
      userId,
      orgId,
      ip,
      userAgent,
      metadata = {},
      sensitivity = SENSITIVITY_LEVELS.INTERNAL,
      outcome = 'success'
    } = data;

    // Sanitize metadata to avoid storing sensitive information
    const sanitizedMetadata = sanitizeMetadata(metadata, sensitivity);

    // Create audit log entry in database
    const auditLog = await prisma.auditLog.create({
      data: {
        eventType,
        userId,
        orgId,
        ip,
        userAgent,
        metadata: sanitizedMetadata,
        sensitivity,
        outcome
      }
    });

    // Also log to file
    auditFileLogger.info({
      eventType,
      userId,
      orgId,
      ip,
      userAgent,
      metadata: sanitizedMetadata,
      sensitivity,
      outcome,
      id: auditLog.id
    });

    return auditLog;
  } catch (error) {
    console.error('Error logging audit event:', error);
    
    // Fallback to file logging if database logging fails
    auditFileLogger.error({
      eventType,
      userId: data.userId,
      error: error.message,
      data
    });
    
    // Don't throw, audit logging should not break application flow
    return null;
  }
}

/**
 * Sanitize metadata based on sensitivity level
 * 
 * @param {Object} metadata - Metadata to sanitize
 * @param {string} sensitivity - Sensitivity level
 * @returns {Object} - Sanitized metadata
 */
function sanitizeMetadata(metadata, sensitivity) {
  // Clone to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(metadata));
  
  // Fields to redact based on sensitivity
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credit_card', 'ssn'];
  const internalFields = ['prompt', 'response', 'email', 'phone', 'address'];
  
  // For critical and sensitive data, redact sensitive fields
  if (sensitivity === SENSITIVITY_LEVELS.CRITICAL || sensitivity === SENSITIVITY_LEVELS.SENSITIVE) {
    sensitiveFields.forEach(field => {
      redactField(sanitized, field);
    });
  }
  
  // For critical, sensitive, and internal data, redact internal fields
  if (sensitivity === SENSITIVITY_LEVELS.CRITICAL || 
      sensitivity === SENSITIVITY_LEVELS.SENSITIVE || 
      sensitivity === SENSITIVITY_LEVELS.INTERNAL) {
    internalFields.forEach(field => {
      redactField(sanitized, field);
    });
  }
  
  return sanitized;
}

/**
 * Redact a field in an object (recursively)
 * 
 * @param {Object} obj - Object to redact field from
 * @param {string} fieldName - Field name to redact
 */
function redactField(obj, fieldName) {
  if (!obj || typeof obj !== 'object') return;
  
  Object.keys(obj).forEach(key => {
    if (key.toLowerCase().includes(fieldName.toLowerCase())) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      redactField(obj[key], fieldName);
    }
  });
}

/**
 * Get audit logs with filtering and pagination
 * 
 * @param {Object} filters - Filters to apply
 * @param {string} filters.userId - Filter by user ID
 * @param {string} filters.orgId - Filter by organization ID
 * @param {string} filters.eventType - Filter by event type
 * @param {string} filters.sensitivity - Filter by sensitivity level
 * @param {string} filters.outcome - Filter by outcome
 * @param {Date} filters.startDate - Filter by start date
 * @param {Date} filters.endDate - Filter by end date
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Page size
 * @returns {Promise<Object>} - Paginated audit logs
 */
async function getAuditLogs(filters = {}, page = 1, pageSize = 20) {
  try {
    const {
      userId,
      orgId,
      eventType,
      sensitivity,
      outcome,
      startDate,
      endDate
    } = filters;
    
    // Build where clause
    const where = {};
    if (userId) where.userId = userId;
    if (orgId) where.orgId = orgId;
    if (eventType) where.eventType = eventType;
    if (sensitivity) where.sensitivity = sensitivity;
    if (outcome) where.outcome = outcome;
    
    // Date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    // Get total count
    const totalCount = await prisma.auditLog.count({ where });
    
    // Get paginated results
    const skip = (page - 1) * pageSize;
    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    });
    
    return {
      data: auditLogs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
}

/**
 * Clean up old audit logs
 * 
 * @param {number} retentionDays - Number of days to retain logs
 * @returns {Promise<number>} - Number of deleted logs
 */
async function cleanupAuditLogs(retentionDays = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const { count } = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    
    auditFileLogger.info(`Cleaned up ${count} audit logs older than ${retentionDays} days`);
    
    return count;
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    auditFileLogger.error(`Error cleaning up audit logs: ${error.message}`);
    throw error;
  }
}

// Convenience methods for common events
const auditLogger = {
  // Export constants
  EVENT_TYPES,
  SENSITIVITY_LEVELS,
  
  // Core logging method
  log: logAuditEvent,
  
  // Authentication events
  loginSuccess: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.LOGIN_SUCCESS, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.INTERNAL
    });
  },
  
  loginFailure: (userId, ip, userAgent, reason, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.LOGIN_FAILURE, {
      userId,
      ip,
      userAgent,
      metadata: { ...metadata, reason },
      sensitivity: SENSITIVITY_LEVELS.INTERNAL,
      outcome: 'failure'
    });
  },
  
  logout: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.LOGOUT, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.PUBLIC
    });
  },
  
  passwordChange: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.PASSWORD_CHANGE, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.SENSITIVE
    });
  },
  
  // Account events
  accountCreated: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.ACCOUNT_CREATED, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.INTERNAL
    });
  },
  
  accountDeletionRequested: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.ACCOUNT_DELETION_REQUESTED, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.SENSITIVE
    });
  },
  
  accountDeleted: (userId, ip, userAgent, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.ACCOUNT_DELETED, {
      userId,
      ip,
      userAgent,
      metadata,
      sensitivity: SENSITIVITY_LEVELS.CRITICAL
    });
  },
  
  // Session events
  sessionCreated: (userId, ip, userAgent, sessionId, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.SESSION_CREATED, {
      userId,
      ip,
      userAgent,
      metadata: { ...metadata, sessionId },
      sensitivity: SENSITIVITY_LEVELS.INTERNAL
    });
  },
  
  sessionRevoked: (userId, ip, userAgent, sessionId, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.SESSION_REVOKED, {
      userId,
      ip,
      userAgent,
      metadata: { ...metadata, sessionId },
      sensitivity: SENSITIVITY_LEVELS.SENSITIVE
    });
  },
  
  // AI events
  aiPrompt: (userId, ip, userAgent, metadata = {}) => {
    // Hash the prompt for privacy
    const hashedPrompt = metadata.prompt ? 
      require('crypto').createHash('sha256').update(metadata.prompt).digest('hex').substring(0, 16) : 
      null;
    
    return logAuditEvent(EVENT_TYPES.AI_PROMPT, {
      userId,
      ip,
      userAgent,
      metadata: { 
        ...metadata,
        prompt: undefined, // Remove the actual prompt
        promptHash: hashedPrompt,
        promptLength: metadata.prompt ? metadata.prompt.length : 0
      },
      sensitivity: SENSITIVITY_LEVELS.INTERNAL
    });
  },
  
  aiError: (userId, ip, userAgent, error, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.AI_ERROR, {
      userId,
      ip,
      userAgent,
      metadata: { ...metadata, error },
      sensitivity: SENSITIVITY_LEVELS.INTERNAL,
      outcome: 'failure'
    });
  },
  
  // Admin events
  adminAction: (userId, ip, userAgent, action, targetId, metadata = {}) => {
    return logAuditEvent(EVENT_TYPES.ADMIN_ACTION, {
      userId,
      ip,
      userAgent,
      metadata: { ...metadata, action, targetId },
      sensitivity: SENSITIVITY_LEVELS.CRITICAL
    });
  },
  
  // Utility methods
  getAuditLogs,
  cleanupAuditLogs
};

module.exports = auditLogger;
