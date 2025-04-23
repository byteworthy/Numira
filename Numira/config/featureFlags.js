/**
 * Feature Flags System
 * 
 * This module provides a centralized way to manage feature flags throughout the application.
 * Features can be toggled on/off via:
 * 1. Environment variables
 * 2. Redis (for dynamic runtime updates)
 * 3. Database (for user/organization specific flags)
 * 
 * Priority order: Database > Redis > Environment variables > Default values
 */

const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cache TTL for feature flags (5 minutes)
const CACHE_TTL = 300;

// Default feature flag values
const DEFAULT_FLAGS = {
  // Core features
  'core.journaling': true,
  'core.insights': true,
  'core.notifications': true,
  'core.offline': true,
  'core.family': process.env.FAMILY_PLAN_ENABLED === 'true',
  
  // AI features
  'ai.mirror-room': true,
  'ai.reframe-room': true,
  'ai.mood-booth': true,
  'ai.clarity-bar': true,
  'ai.streak-studio': true,
  'ai.archive': true,
  'ai.emergency-reset': true,
  'ai.gpt4': process.env.GPT4_ENABLED === 'true',
  
  // Subscription features
  'subscription.stripe': process.env.STRIPE_ENABLED === 'true',
  'subscription.revenuecat': process.env.REVENUECAT_ENABLED === 'true',
  'subscription.trial': true,
  
  // Experimental features
  'experimental.voice-input': process.env.VOICE_INPUT_ENABLED === 'true' || false,
  'experimental.image-generation': process.env.IMAGE_GENERATION_ENABLED === 'true' || false,
  'experimental.multilingual': process.env.MULTILINGUAL_ENABLED === 'true' || false,
  
  // Infrastructure features
  'infra.metrics': process.env.METRICS_ENDPOINT_ENABLED === 'true' || false,
  'infra.audit-logging': process.env.AUDIT_LOGGING_ENABLED === 'true' || true,
  'infra.openai-fallback': true,
  'infra.cache': process.env.CACHE_ENABLED === 'true' || true,
  
  // Security features
  'security.mfa': process.env.MFA_ENABLED === 'true' || false,
  'security.rate-limiting': true,
  'security.content-moderation': true
};

/**
 * Get all feature flags
 * 
 * @param {Object} options - Options
 * @param {string} options.userId - User ID for user-specific flags
 * @param {string} options.orgId - Organization ID for org-specific flags
 * @param {boolean} options.useCache - Whether to use cache
 * @returns {Promise<Object>} Feature flags
 */
async function getAllFlags(options = {}) {
  const { userId, orgId, useCache = true } = options;
  
  try {
    // Try to get from cache first
    if (useCache) {
      const cacheKey = `feature-flags:${userId || 'global'}:${orgId || 'global'}`;
      const cachedFlags = await cacheService.get(cacheKey);
      
      if (cachedFlags) {
        return cachedFlags;
      }
    }
    
    // Start with default flags
    const flags = { ...DEFAULT_FLAGS };
    
    // Override with environment variables
    Object.keys(flags).forEach(key => {
      const envKey = `FEATURE_${key.replace(/\./g, '_').toUpperCase()}`;
      if (process.env[envKey] !== undefined) {
        flags[key] = process.env[envKey] === 'true';
      }
    });
    
    // Override with Redis flags (for dynamic runtime updates)
    try {
      const redisFlags = await cacheService.get('feature-flags:global');
      if (redisFlags) {
        Object.assign(flags, redisFlags);
      }
    } catch (redisError) {
      logger.warn('Failed to get feature flags from Redis', { error: redisError.message });
    }
    
    // Override with organization-specific flags from database
    if (orgId) {
      try {
        const orgFlags = await prisma.featureFlag.findMany({
          where: { orgId }
        });
        
        orgFlags.forEach(flag => {
          flags[flag.key] = flag.enabled;
        });
      } catch (dbError) {
        logger.warn('Failed to get organization feature flags from database', { 
          error: dbError.message,
          orgId
        });
      }
    }
    
    // Override with user-specific flags from database
    if (userId) {
      try {
        const userFlags = await prisma.featureFlag.findMany({
          where: { userId }
        });
        
        userFlags.forEach(flag => {
          flags[flag.key] = flag.enabled;
        });
      } catch (dbError) {
        logger.warn('Failed to get user feature flags from database', { 
          error: dbError.message,
          userId
        });
      }
    }
    
    // Cache the result
    if (useCache) {
      const cacheKey = `feature-flags:${userId || 'global'}:${orgId || 'global'}`;
      await cacheService.set(cacheKey, flags, CACHE_TTL);
    }
    
    return flags;
  } catch (error) {
    logger.error('Error getting feature flags', { error: error.message });
    return DEFAULT_FLAGS;
  }
}

/**
 * Check if a feature is enabled
 * 
 * @param {string} key - Feature key
 * @param {Object} options - Options
 * @param {string} options.userId - User ID for user-specific flags
 * @param {string} options.orgId - Organization ID for org-specific flags
 * @param {boolean} options.useCache - Whether to use cache
 * @returns {Promise<boolean>} Whether the feature is enabled
 */
async function isEnabled(key, options = {}) {
  try {
    const flags = await getAllFlags(options);
    return flags[key] === true;
  } catch (error) {
    logger.error('Error checking feature flag', { key, error: error.message });
    return DEFAULT_FLAGS[key] === true;
  }
}

/**
 * Set a feature flag
 * 
 * @param {string} key - Feature key
 * @param {boolean} enabled - Whether the feature is enabled
 * @param {Object} options - Options
 * @param {string} options.userId - User ID for user-specific flag
 * @param {string} options.orgId - Organization ID for org-specific flag
 * @param {boolean} options.global - Whether this is a global flag
 * @returns {Promise<Object>} Updated feature flag
 */
async function setFlag(key, enabled, options = {}) {
  const { userId, orgId, global = false } = options;
  
  try {
    // Validate the key
    if (!DEFAULT_FLAGS.hasOwnProperty(key)) {
      throw new Error(`Invalid feature flag key: ${key}`);
    }
    
    // Set in database if user or org specific
    if (userId || orgId) {
      const flag = await prisma.featureFlag.upsert({
        where: {
          key_userId_orgId: {
            key,
            userId: userId || null,
            orgId: orgId || null
          }
        },
        update: { enabled },
        create: {
          key,
          enabled,
          userId: userId || null,
          orgId: orgId || null
        }
      });
      
      // Invalidate cache
      const cacheKey = `feature-flags:${userId || 'global'}:${orgId || 'global'}`;
      await cacheService.del(cacheKey);
      
      return flag;
    }
    
    // Set in Redis if global
    if (global) {
      const redisFlags = await cacheService.get('feature-flags:global') || {};
      redisFlags[key] = enabled;
      await cacheService.set('feature-flags:global', redisFlags);
      
      // Invalidate all caches
      await cacheService.delByPattern('feature-flags:*');
      
      return { key, enabled };
    }
    
    throw new Error('Must specify userId, orgId, or global=true');
  } catch (error) {
    logger.error('Error setting feature flag', { 
      key, 
      enabled, 
      userId, 
      orgId, 
      global,
      error: error.message 
    });
    throw error;
  }
}

/**
 * Reset feature flags to defaults
 * 
 * @param {Object} options - Options
 * @param {string} options.userId - User ID to reset flags for
 * @param {string} options.orgId - Organization ID to reset flags for
 * @param {boolean} options.global - Whether to reset global flags
 * @returns {Promise<boolean>} Success
 */
async function resetFlags(options = {}) {
  const { userId, orgId, global = false } = options;
  
  try {
    // Delete from database if user or org specific
    if (userId || orgId) {
      const where = {};
      if (userId) where.userId = userId;
      if (orgId) where.orgId = orgId;
      
      await prisma.featureFlag.deleteMany({ where });
      
      // Invalidate cache
      const cacheKey = `feature-flags:${userId || 'global'}:${orgId || 'global'}`;
      await cacheService.del(cacheKey);
    }
    
    // Delete from Redis if global
    if (global) {
      await cacheService.del('feature-flags:global');
      
      // Invalidate all caches
      await cacheService.delByPattern('feature-flags:*');
    }
    
    return true;
  } catch (error) {
    logger.error('Error resetting feature flags', { 
      userId, 
      orgId, 
      global,
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get feature flags for a specific user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Feature flags
 */
async function getUserFlags(userId) {
  return getAllFlags({ userId });
}

/**
 * Get feature flags for a specific organization
 * 
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Feature flags
 */
async function getOrgFlags(orgId) {
  return getAllFlags({ orgId });
}

/**
 * Get global feature flags
 * 
 * @returns {Promise<Object>} Feature flags
 */
async function getGlobalFlags() {
  return getAllFlags();
}

module.exports = {
  DEFAULT_FLAGS,
  getAllFlags,
  isEnabled,
  setFlag,
  resetFlags,
  getUserFlags,
  getOrgFlags,
  getGlobalFlags
};
