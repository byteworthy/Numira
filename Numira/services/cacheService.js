/**
 * Cache Service
 * 
 * Provides caching functionality using Redis for improved performance.
 * Implements methods for storing, retrieving, and invalidating cached data.
 */

const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Create Redis client for caching with connection pooling
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.cacheDb || 0,
  tls: config.redis.tls ? {} : undefined,
  keyPrefix: 'cache:',
  
  // Connection pooling configuration
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: false,
  connectTimeout: 10000,
  
  // Additional reliability settings
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  }
});

// Create a Redis connection pool manager
const redisConnectionPool = {
  getConnection: () => redisClient,
  
  // Method to check health of the connection
  async ping() {
    try {
      return await redisClient.ping();
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      return false;
    }
  }
};

// Log Redis connection errors
redisClient.on('error', (err) => {
  logger.error('Redis cache connection error', { error: err.message });
});

// Log successful connection
redisClient.on('connect', () => {
  logger.info('Redis cache connected successfully');
});

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
      await redisClient.set(key, serializedValue, 'EX', ttl);
    } else {
      await redisClient.set(key, serializedValue);
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
    const value = await redisClient.get(key);
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
    await redisClient.del(key);
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
    // Get all keys matching the pattern
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      // Delete all matching keys
      await redisClient.del(...keys);
      logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
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
    await redisClient.flushdb();
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
    const info = await redisClient.info();
    const dbSize = await redisClient.dbsize();
    
    return {
      size: dbSize,
      info: info
    };
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

module.exports = {
  generateCacheKey,
  set,
  get,
  del,
  delByPattern,
  getOrSet,
  clear,
  getStats,
  cachedAIResponse,
  redisConnectionPool
};
