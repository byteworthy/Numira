/**
 * Cache Service
 * 
 * Provides caching functionality using Redis for improved performance.
 * Falls back to in-memory cache when Redis is unavailable (Replit compatibility).
 * Implements methods for storing, retrieving, and invalidating cached data with TTL support.
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { checkRedisConnection, createRedisClient } = require('../utils/checkRedis');

// Flag to track Redis availability
let redisAvailable = false;
let redisClient = null;

// In-memory cache as fallback when Redis is unavailable
const memoryCache = new Map();
const memoryCacheExpiry = new Map();

// Initialize Redis client if available
const initializeRedis = async () => {
  // Check Redis connection
  redisAvailable = await checkRedisConnection();
  
  if (!redisAvailable) {
    logger.info('Redis unavailable - using in-memory cache for Replit compatibility');
    console.log('Cache fallback active: Using in-memory cache system for Replit compatibility');
    return;
  }
  
  try {
    // Create Redis client for caching
    redisClient = createRedisClient();
    
    if (!redisClient) {
      throw new Error('Failed to create Redis client');
    }
    
    // Set key prefix for cache keys
    redisClient.options.keyPrefix = 'cache:';
    
    logger.info('Redis cache service initialized successfully');
  } catch (error) {
    redisAvailable = false;
    logger.error('Failed to initialize Redis cache service', { error: error.message });
    logger.info('Falling back to in-memory cache');
  }
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
    
    if (redisAvailable && redisClient) {
      if (ttl > 0) {
        await redisClient.set(key, serializedValue, 'EX', ttl);
      } else {
        await redisClient.set(key, serializedValue);
      }
    } else {
      // Use in-memory cache as fallback
      memoryCache.set(key, serializedValue);
      
      if (ttl > 0) {
        // Set expiry time
        const expiryTime = Date.now() + (ttl * 1000);
        memoryCacheExpiry.set(key, expiryTime);
        
        // Schedule cleanup for expired items
        setTimeout(() => {
          if (memoryCacheExpiry.get(key) <= Date.now()) {
            memoryCache.delete(key);
            memoryCacheExpiry.delete(key);
          }
        }, ttl * 1000);
      }
    }
    
    return true;
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
    let value;
    
    if (redisAvailable && redisClient) {
      value = await redisClient.get(key);
    } else {
      // Use in-memory cache as fallback
      value = memoryCache.get(key);
      
      // Check if value has expired
      const expiryTime = memoryCacheExpiry.get(key);
      if (expiryTime && expiryTime <= Date.now()) {
        memoryCache.delete(key);
        memoryCacheExpiry.delete(key);
        return null;
      }
    }
    
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
    if (redisAvailable && redisClient) {
      await redisClient.del(key);
    } else {
      // Use in-memory cache as fallback
      memoryCache.delete(key);
      memoryCacheExpiry.delete(key);
    }
    
    return true;
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
    if (redisAvailable && redisClient) {
      // Get all keys matching the pattern
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await redisClient.del(...keys);
        logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } else {
      // Use in-memory cache as fallback
      // Convert glob pattern to regex
      const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      let count = 0;
      
      // Iterate through all keys and delete matches
      for (const key of memoryCache.keys()) {
        if (regexPattern.test(key)) {
          memoryCache.delete(key);
          memoryCacheExpiry.delete(key);
          count++;
        }
      }
      
      if (count > 0) {
        logger.info(`Deleted ${count} in-memory cache keys matching pattern: ${pattern}`);
      }
    }
    
    return true;
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
    if (redisAvailable && redisClient) {
      await redisClient.flushdb();
    } else {
      // Use in-memory cache as fallback
      memoryCache.clear();
      memoryCacheExpiry.clear();
    }
    
    logger.info('Cache cleared');
    return true;
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
    if (redisAvailable && redisClient) {
      const info = await redisClient.info();
      const dbSize = await redisClient.dbsize();
      
      return {
        size: dbSize,
        info: info,
        type: 'redis'
      };
    } else {
      // Use in-memory cache as fallback
      return {
        size: memoryCache.size,
        info: 'In-memory cache',
        type: 'memory'
      };
    }
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
  return redisAvailable;
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
