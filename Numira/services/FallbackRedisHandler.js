/**
 * FallbackRedisHandler Service
 * 
 * Provides a fallback mechanism for Redis operations when Redis is unavailable.
 * Implements an in-memory storage with TTL support that mimics Redis functionality.
 * Can be used by any service that requires Redis with automatic fallback capability.
 */

const logger = require('../utils/logger');
const config = require('../config/config');
const { checkRedisConnection, createRedisClient } = require('../utils/checkRedis');

class FallbackRedisHandler {
  /**
   * Create a new FallbackRedisHandler instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.serviceName - Name of the service using this handler (for logging)
   * @param {boolean} options.devMode - Whether to log fallback messages (default: true in development, false in production)
   * @param {Object} options.redisOptions - Redis client options to pass to createRedisClient
   */
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'service';
    this.devMode = options.devMode !== undefined ? 
      options.devMode : 
      config.server.env !== 'production';
    this.redisOptions = options.redisOptions || {};
    
    // Redis client and availability flag
    this.redisClient = null;
    this.redisAvailable = false;
    
    // In-memory storage for fallback
    this.memoryStorage = new Map();
    this.memoryExpiry = new Map();
    
    // Cleanup interval for expired items (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanupExpiredItems(), 5 * 60 * 1000);
  }
  
  /**
   * Initialize Redis connection and check availability
   * 
   * @returns {Promise<boolean>} - Whether Redis is available
   */
  async initialize() {
    try {
      // Check if Redis is available
      this.redisAvailable = await checkRedisConnection();
      
      if (!this.redisAvailable) {
        this._logFallback('Redis unavailable - using in-memory fallback storage');
        return false;
      }
      
      // Create Redis client
      this.redisClient = createRedisClient(this.redisOptions);
      
      if (!this.redisClient) {
        throw new Error('Failed to create Redis client');
      }
      
      logger.info(`Redis connection successful for ${this.serviceName}`);
      return true;
    } catch (error) {
      this.redisAvailable = false;
      logger.error(`Failed to initialize Redis for ${this.serviceName}`, { error: error.message });
      this._logFallback('Falling back to in-memory storage');
      return false;
    }
  }
  
  /**
   * Log fallback messages only in dev mode
   * 
   * @param {string} message - Message to log
   * @private
   */
  _logFallback(message) {
    logger.info(`${this.serviceName}: ${message}`);
    
    // Only log to console in dev mode
    if (this.devMode) {
      console.log(`${this.serviceName} fallback active: ${message}`);
    }
  }
  
  /**
   * Check if Redis is available
   * 
   * @returns {boolean} - Whether Redis is available
   */
  isRedisAvailable() {
    return this.redisAvailable && this.redisClient !== null;
  }
  
  /**
   * Set a value with optional TTL
   * 
   * @param {string} key - Key to set
   * @param {string} value - String value to store
   * @param {string} [expiryType] - 'EX' for seconds, 'PX' for milliseconds
   * @param {number} [expiryValue] - Expiry time in seconds or milliseconds
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async set(key, value, expiryType, expiryValue) {
    try {
      if (this.isRedisAvailable()) {
        if (expiryType && expiryValue) {
          await this.redisClient.set(key, value, expiryType, expiryValue);
        } else {
          await this.redisClient.set(key, value);
        }
      } else {
        // Store in memory
        this.memoryStorage.set(key, value);
        
        // Handle expiry if provided
        if (expiryType && expiryValue) {
          const now = Date.now();
          let expiryMs;
          
          if (expiryType.toUpperCase() === 'EX') {
            expiryMs = expiryValue * 1000; // Convert seconds to milliseconds
          } else if (expiryType.toUpperCase() === 'PX') {
            expiryMs = expiryValue;
          }
          
          if (expiryMs) {
            this.memoryExpiry.set(key, now + expiryMs);
          }
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`${this.serviceName} set error`, { key, error: error.message });
      return false;
    }
  }
  
  /**
   * Get a value
   * 
   * @param {string} key - Key to get
   * @returns {Promise<string|null>} - Stored value or null if not found
   */
  async get(key) {
    try {
      if (this.isRedisAvailable()) {
        return await this.redisClient.get(key);
      } else {
        // Check if key exists in memory
        if (!this.memoryStorage.has(key)) {
          return null;
        }
        
        // Check if value has expired
        const expiryTime = this.memoryExpiry.get(key);
        if (expiryTime && expiryTime <= Date.now()) {
          // Remove expired item
          this.memoryStorage.delete(key);
          this.memoryExpiry.delete(key);
          return null;
        }
        
        return this.memoryStorage.get(key);
      }
    } catch (error) {
      logger.error(`${this.serviceName} get error`, { key, error: error.message });
      return null;
    }
  }
  
  /**
   * Delete a key
   * 
   * @param {string} key - Key to delete
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async del(key) {
    try {
      if (this.isRedisAvailable()) {
        await this.redisClient.del(key);
      } else {
        this.memoryStorage.delete(key);
        this.memoryExpiry.delete(key);
      }
      
      return true;
    } catch (error) {
      logger.error(`${this.serviceName} del error`, { key, error: error.message });
      return false;
    }
  }
  
  /**
   * Delete keys matching a pattern
   * 
   * @param {string} pattern - Pattern to match keys (e.g., "user:*")
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async delByPattern(pattern) {
    try {
      if (this.isRedisAvailable()) {
        // Get all keys matching the pattern
        const keys = await this.redisClient.keys(pattern);
        
        if (keys.length > 0) {
          // Delete all matching keys
          await this.redisClient.del(...keys);
          logger.debug(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
        }
      } else {
        // Convert glob pattern to regex
        const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        let count = 0;
        
        // Iterate through all keys and delete matches
        for (const key of this.memoryStorage.keys()) {
          if (regexPattern.test(key)) {
            this.memoryStorage.delete(key);
            this.memoryExpiry.delete(key);
            count++;
          }
        }
        
        if (count > 0) {
          logger.debug(`Deleted ${count} in-memory cache keys matching pattern: ${pattern}`);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`${this.serviceName} delByPattern error`, { pattern, error: error.message });
      return false;
    }
  }
  
  /**
   * Clear all stored data
   * 
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async clear() {
    try {
      if (this.isRedisAvailable()) {
        await this.redisClient.flushdb();
      } else {
        this.memoryStorage.clear();
        this.memoryExpiry.clear();
      }
      
      logger.info(`${this.serviceName}: Cache cleared`);
      return true;
    } catch (error) {
      logger.error(`${this.serviceName} clear error`, { error: error.message });
      return false;
    }
  }
  
  /**
   * Get statistics about the storage
   * 
   * @returns {Promise<Object>} - Statistics object
   */
  async getStats() {
    try {
      if (this.isRedisAvailable()) {
        const info = await this.redisClient.info();
        const dbSize = await this.redisClient.dbsize();
        
        return {
          size: dbSize,
          info: info,
          type: 'redis'
        };
      } else {
        return {
          size: this.memoryStorage.size,
          info: 'In-memory storage',
          type: 'memory'
        };
      }
    } catch (error) {
      logger.error(`${this.serviceName} getStats error`, { error: error.message });
      return { error: error.message };
    }
  }
  
  /**
   * Clean up expired items from memory storage
   * 
   * @private
   */
  cleanupExpiredItems() {
    const now = Date.now();
    let count = 0;
    
    // Check all keys with expiry times
    for (const [key, expiryTime] of this.memoryExpiry.entries()) {
      if (expiryTime <= now) {
        this.memoryStorage.delete(key);
        this.memoryExpiry.delete(key);
        count++;
      }
    }
    
    if (count > 0 && this.devMode) {
      logger.debug(`${this.serviceName}: Cleaned up ${count} expired items from memory storage`);
    }
  }
  
  /**
   * Close the handler and clean up resources
   */
  close() {
    // Clear the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close Redis client if it exists
    if (this.redisClient) {
      this.redisClient.quit().catch(err => {
        logger.error(`Error closing Redis client: ${err.message}`);
      });
    }
    
    // Clear memory storage
    this.memoryStorage.clear();
    this.memoryExpiry.clear();
  }
}

module.exports = FallbackRedisHandler;
