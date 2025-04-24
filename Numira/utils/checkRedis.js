/**
 * Redis Connection Checker
 * 
 * Utility to test Redis connectivity with timeout.
 * Used by Redis-dependent services to determine if Redis is available.
 */

const Redis = require('ioredis');
const logger = require('./logger');
const config = require('../config/config');

/**
 * Test Redis connection with timeout
 * 
 * @param {Object} options - Redis connection options
 * @param {number} timeout - Connection timeout in milliseconds
 * @param {string} serviceName - Name of the service checking Redis
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function checkRedisConnection(options = {}, timeout = 5000, serviceName = 'service') {
  try {
    // Create Redis client with provided options
    const redisOptions = {
      host: options.host || config.redis.host,
      port: options.port || config.redis.port,
      password: options.password || config.redis.password || undefined,
      db: options.db || 0,
      connectTimeout: timeout,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true
    };
    
    const redis = new Redis(redisOptions);
    
    // Suppress noisy reconnect errors
    redis.on('error', () => {});
    
    // Try to connect and ping
    await redis.connect();
    await redis.ping();
    await redis.quit();
    
    logger.info(`Redis connection successful for ${serviceName}`);
    return true;
  } catch (error) {
    logger.warn(`Redis connection failed for ${serviceName}, using fallback`, {
      error: error.message,
      host: options.host || config.redis.host,
      port: options.port || config.redis.port
    });
    return false;
  }
}

/**
 * Create Redis client with error handling
 * 
 * @param {Object} options - Redis connection options
 * @param {string} serviceName - Name of the service using Redis
 * @returns {Object} - Redis client or null if connection failed
 */
function createRedisClient(options = {}, serviceName = 'service') {
  try {
    // Create Redis client with provided options
    const redisOptions = {
      host: options.host || config.redis.host,
      port: options.port || config.redis.port,
      password: options.password || config.redis.password || undefined,
      db: options.db || 0,
      tls: options.tls || (config.redis.tls ? {} : undefined),
      keyPrefix: options.keyPrefix || '',
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    };
    
    const redis = new Redis(redisOptions);
    
    // Suppress noisy reconnect errors
    redis.on('error', () => {});
    
    // Log only critical Redis errors once
    let errorLogged = false;
    redis.on('error', (err) => {
      // Only log the first error or critical errors
      if (!errorLogged && (err.code !== 'ECONNREFUSED' && err.code !== 'ETIMEDOUT')) {
        logger.error(`Redis ${serviceName} critical error`, { error: err.message });
        errorLogged = true;
      }
    });
    
    // Log successful connection
    redis.on('connect', () => {
      logger.info(`Redis ${serviceName} connected successfully`);
    });
    
    return redis;
  } catch (error) {
    logger.error(`Failed to create Redis client for ${serviceName}`, { error: error.message });
    return null;
  }
}

module.exports = {
  checkRedisConnection,
  createRedisClient
};
