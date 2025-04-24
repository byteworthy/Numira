/**
 * Redis Connection Checker
 * 
 * Utility to test Redis connectivity with timeout.
 * Used by Redis-dependent services to determine if Redis is available.
 * Provides fallback support for Replit environments.
 */

const Redis = require('ioredis');
const logger = require('./logger');
const config = require('../config/config');

/**
 * Test Redis connection with timeout
 * 
 * @param {number} timeout - Connection timeout in milliseconds
 * @returns {Promise<boolean>} - True if Redis is available, false otherwise
 */
async function checkRedisConnection(timeout = 1000) {
  try {
    // Create Redis client with default options
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
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
    
    logger.info(`Redis connection successful`);
    return true;
  } catch (error) {
    logger.warn(`Redis connection failed, using fallback mode`, {
      error: error.message,
      host: config.redis.host,
      port: config.redis.port
    });
    return false;
  }
}

/**
 * Create Redis client with error handling
 * 
 * @returns {Object} - Redis client or null if connection failed
 */
function createRedisClient() {
  try {
    // Create Redis client with default options
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      tls: config.redis.tls ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    };
    
    const redis = new Redis(redisOptions);
    
    // Suppress noisy reconnect errors
    redis.on('error', () => {});
    
    return redis;
  } catch (error) {
    logger.error(`Failed to create Redis client`, { error: error.message });
    return null;
  }
}

module.exports = {
  checkRedisConnection,
  createRedisClient
};
