/**
 * Cache Service
 * 
 * Provides caching functionality using Redis for improved performance.
 * Uses FallbackRedisHandler for automatic fallback to in-memory cache when Redis is unavailable.
 * Implements methods for storing, retrieving, and invalidating cached data with TTL support.
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const crypto = require('crypto');
const FallbackRedisHandler = require('./FallbackRedisHandler');

// Create Redis handler with fallback capability
const redisHandler = new FallbackRedisHandler({
  serviceName: 'CacheService',
  devMode: config.server.env !== 'production',
  redisOptions: {
    keyPrefix: 'cache:'
  }
});

// Initialize Redis client if available
const initializeRedis = async () => {
  await redisHandler.initialize();
};

/**
 * Generate a cache key from the provided parameters
 * 
 * @param {string} prefix - Prefix for the cache key
 * @param {Object} params - Parameters to include in the key
 * @returns {string} - Generated cache key
 */
function generateCacheKey(prefix, params) {
  // Sort keys to ensure consistent key generation regardless of object property order
  const sortedParams = {};
  Object.keys(params).sort().forEach(key => {
    sortedParams[key] = params[key];
  });
  
  // Create a hash of the stringified parameters
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(sortedParams))
    .digest('hex');
  
  return `${prefix}:${hash}`;
}

/**
 * Set a value in the cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} - True if successful
 */
async function set(key, value, ttl = 3600) {
  try {
    const serializedValue = JSON.stringify(value);
    
    if (ttl > 0) {
      return await redisHandler.set(key, serializedValue, 'EX', ttl);
    } else {
      return await redisHandler.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    return false;
  }
}

/**
 * Get a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null if not found
 */
async function get(key) {
  try {
    const value = await redisHandler.get(key);
    
    if (!value) return null;
    
    return JSON.parse(value);
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    return null;
  }
}

/**
 * Delete a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - True if successful
 */
async function del(key) {
  try {
    return await redisHandler.del(key);
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    return false;
  }
}

/**
 * Delete multiple values from the cache using a pattern
 * 
 * @param {string} pattern - Pattern to match keys (e.g., "user:*")
 * @returns {Promise<boolean>} - True if successful
 */
async function delByPattern(pattern) {
  try {
    return await redisHandler.delByPattern(pattern);
  } catch (error) {
    logger.error('Cache delete by pattern error', { pattern, error: error.message });
    return false;
  }
}

/**
 * Get or set cache value with a function to generate the value if not found
 * 
 * @param {string} key - Cache key
 * @param {Function} fn - Function to generate value if not in cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} - Cached or generated value
 */
async function getOrSet(key, fn, ttl = 3600) {
  try {
    // Try to get from cache first
    const cachedValue = await get(key);
    if (cachedValue !== null) {
      logger.debug('Cache hit', { key });
      return cachedValue;
    }
    
    // Generate value if not in cache
    logger.debug('Cache miss', { key });
    const value = await fn();
    
    // Store in cache for future requests
    await set(key, value, ttl);
    
    return value;
  } catch (error) {
    logger.error('Cache getOrSet error', { key, error: error.message });
    // If cache fails, just execute the function
    return await fn();
  }
}

/**
 * Clear the entire cache
 * 
 * @returns {Promise<boolean>} - True if successful
 */
async function clear() {
  try {
    return await redisHandler.clear();
  } catch (error) {
    logger.error('Cache clear error', { error: error.message });
    return false;
  }
}

/**
 * Get cache statistics
 * 
 * @returns {Promise<Object>} - Cache statistics
 */
async function getStats() {
  try {
    return await redisHandler.getStats();
  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    return { error: error.message };
  }
}

/**
 * Wrapper for AI response caching
 * 
 * @param {string} userInput - User input text
 * @param {string} personaId - Persona ID
 * @param {string} roomId - Room ID
 * @param {Function} generateFn - Function to generate AI response
 * @returns {Promise<Object>} - AI response
 */
async function cachedAIResponse(userInput, personaId, roomId, generateFn) {
  // Create a cache key based on the input parameters
  const key = generateCacheKey('ai', { 
    input: userInput.toLowerCase().trim(), 
    personaId, 
    roomId 
  });
  
  // Cache AI responses for 24 hours (86400 seconds)
  return await getOrSet(key, generateFn, 86400);
}

// Check if Redis is available
const isRedisAvailable = () => {
  return redisHandler.isRedisAvailable();
};

module.exports = {
  initializeRedis,
  isRedisAvailable,
  generateCacheKey,
  set,
  get,
  del,
  delByPattern,
  getOrSet,
  clear,
  getStats,
  cachedAIResponse
};
