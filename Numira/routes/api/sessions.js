/**
 * Session Management API Routes
 * 
 * Provides endpoints to view and manage user sessions.
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const auditLogger = require('../../utils/auditLogger');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');

/**
 * @route   GET /api/sessions
 * @desc    Get all active sessions for the current user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    // Get all active sessions for the user
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Enhance session data with device info
    const enhancedSessions = sessions.map(session => {
      const parser = new UAParser(session.userAgent);
      const device = parser.getDevice();
      const browser = parser.getBrowser();
      const os = parser.getOS();
      
      // Determine if this is the current session
      const isCurrentSession = session.id === req.session.id;
      
      return {
        id: session.id,
        deviceName: device.vendor ? `${device.vendor} ${device.model}` : 'Unknown Device',
        browserName: browser.name || 'Unknown Browser',
        osName: os.name ? `${os.name} ${os.version || ''}` : 'Unknown OS',
        ipAddress: session.ipAddress,
        lastActive: session.updatedAt,
        createdAt: session.createdAt,
        isCurrentSession
      };
    });
    
    res.json(enhancedSessions);
  } catch (error) {
    logger.error('Error getting user sessions', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the session exists and belongs to the user
    const session = await prisma.session.findUnique({
      where: { id }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.userId !== req.user.id) {
      // Log unauthorized attempt
      auditLogger.log(auditLogger.EVENT_TYPES.SESSION_REVOKED, {
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { sessionId: id, unauthorized: true },
        sensitivity: auditLogger.SENSITIVITY_LEVELS.SENSITIVE,
        outcome: 'failure'
      });
      
      return res.status(403).json({ error: 'Not authorized to revoke this session' });
    }
    
    // Check if trying to revoke current session
    if (session.id === req.session.id) {
      return res.status(400).json({ 
        error: 'Cannot revoke current session. Use logout instead.' 
      });
    }
    
    // Revoke the session
    await prisma.session.update({
      where: { id },
      data: {
        expiresAt: new Date(),
        revokedAt: new Date()
      }
    });
    
    // Log the session revocation
    auditLogger.sessionRevoked(
      req.user.id,
      req.ip,
      req.headers['user-agent'],
      id
    );
    
    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    logger.error('Error revoking session', { 
      sessionId: req.params.id,
      error: error.message 
    });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/sessions
 * @desc    Revoke all sessions except the current one
 * @access  Private
 */
router.delete('/', auth, async (req, res) => {
  try {
    // Revoke all sessions except the current one
    const { count } = await prisma.session.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.session.id },
        expiresAt: { gt: new Date() }
      },
      data: {
        expiresAt: new Date(),
        revokedAt: new Date()
      }
    });
    
    // Log the session revocation
    auditLogger.log(auditLogger.EVENT_TYPES.SESSION_REVOKED, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { allSessions: true, count },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.SENSITIVE
    });
    
    res.json({ 
      success: true, 
      message: `${count} sessions revoked successfully` 
    });
  } catch (error) {
    logger.error('Error revoking all sessions', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Generate a device fingerprint from request data
 * 
 * @param {Object} req - Express request object
 * @returns {string} Device fingerprint
 */
function generateDeviceFingerprint(req) {
  // Combine user agent, IP address, and other available data
  const data = [
    req.headers['user-agent'] || '',
    req.ip || '',
    req.headers['accept-language'] || ''
  ].join('|');
  
  // Create a hash of the data
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create a new session for a user
 * 
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Created session
 */
async function createSession(userId, req, token) {
  try {
    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Set expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Create session in database
    const session = await prisma.session.create({
      data: {
        userId,
        token,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceFingerprint,
        expiresAt
      }
    });
    
    // Log the session creation
    auditLogger.sessionCreated(
      userId,
      req.ip,
      req.headers['user-agent'],
      session.id
    );
    
    return session;
  } catch (error) {
    logger.error('Error creating session', { 
      userId,
      error: error.message 
    });
    throw error;
  }
}

/**
 * Validate a session
 * 
 * @param {string} token - Authentication token
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} Session if valid, null otherwise
 */
async function validateSession(token, req) {
  try {
    // Find the session
    const session = await prisma.session.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date()
        },
        revokedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            orgId: true
          }
        }
      }
    });
    
    if (!session) {
      return null;
    }
    
    // Check if user is active
    if (!session.user.isActive) {
      return null;
    }
    
    // Verify device fingerprint (optional security measure)
    const currentFingerprint = generateDeviceFingerprint(req);
    const fingerprintMatches = session.deviceFingerprint === currentFingerprint;
    
    // If fingerprint doesn't match, log suspicious activity but still allow access
    // This is a soft security measure - you could make it strict by returning null
    if (!fingerprintMatches) {
      logger.warn('Session device fingerprint mismatch', {
        sessionId: session.id,
        userId: session.userId,
        storedFingerprint: session.deviceFingerprint,
        currentFingerprint
      });
      
      // Log suspicious activity
      auditLogger.log(auditLogger.EVENT_TYPES.SESSION_SUSPICIOUS, {
        userId: session.userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { 
          sessionId: session.id,
          fingerprintMismatch: true,
          storedIp: session.ipAddress,
          currentIp: req.ip
        },
        sensitivity: auditLogger.SENSITIVITY_LEVELS.SENSITIVE
      });
    }
    
    // Update last activity time
    await prisma.session.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });
    
    // Attach session to request for use in other routes
    req.session = session;
    
    return session.user;
  } catch (error) {
    logger.error('Error validating session', { error: error.message });
    return null;
  }
}

/**
 * Revoke a session
 * 
 * @param {string} token - Authentication token
 * @returns {Promise<boolean>} Success
 */
async function revokeSession(token) {
  try {
    // Find and revoke the session
    const session = await prisma.session.findFirst({
      where: { token }
    });
    
    if (!session) {
      return false;
    }
    
    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(),
        revokedAt: new Date()
      }
    });
    
    return true;
  } catch (error) {
    logger.error('Error revoking session', { error: error.message });
    return false;
  }
}

/**
 * Clean up expired sessions
 * 
 * @returns {Promise<number>} Number of deleted sessions
 */
async function cleanupExpiredSessions() {
  try {
    // Delete sessions that expired more than 7 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    const { count } = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: cutoffDate
        }
      }
    });
    
    logger.info(`Cleaned up ${count} expired sessions`);
    return count;
  } catch (error) {
    logger.error('Error cleaning up expired sessions', { error: error.message });
    throw error;
  }
}

module.exports = {
  router,
  createSession,
  validateSession,
  revokeSession,
  cleanupExpiredSessions
};
