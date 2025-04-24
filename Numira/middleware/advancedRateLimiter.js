/**
 * Advanced Rate Limiter Middleware
 * 
 * Provides both IP-based and user-based rate limiting with Redis storage.
 * Falls back to memory store when Redis is unavailable.
 * Configurable limits, windows, and different limits for different routes.
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');
const { checkRedisConnection, createRedisClient } = require('../utils/checkRedis');

// Flag to track Redis availability
let redisAvailable = true;
let redisClient = null;

// Initialize Redis client if available
const initializeRedis = async () => {
  // Only check Redis in development mode
  if (config.server.env === 'development') {
    redisAvailable = await checkRedisConnection(config.redis, 5000, 'rate-limiter');
  }
  
  if (!redisAvailable) {
    logger.info('Running without Redis in development mode - using memory store for rate limiting');
    return;
  }
  
  try {
    // Create Redis client for rate limiting
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      tls: config.redis.tls ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    };
    
    redisClient = createRedisClient(redisOptions, 'rate-limiter');
    
    if (!redisClient) {
      redisAvailable = false;
      logger.error('Failed to create Redis client for rate limiting');
      logger.info('Falling back to memory store for rate limiting');
      return;
    }
    
    logger.info('Redis rate limiter initialized successfully');
  } catch (error) {
    redisAvailable = false;
    logger.error('Failed to initialize Redis for rate limiting', { error: error.message });
    logger.info('Falling back to memory store for rate limiting');
  }
};

/**
 * Create a store for rate limiting
 * 
 * @param {string} prefix - Key prefix for Redis
 * @returns {Object} Redis store or memory store
 */
function createStore(prefix) {
  if (redisAvailable && redisClient) {
    return new RedisStore({
      // @ts-ignore - Type definitions are outdated
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `ratelimit:${prefix}:`
    });
  }
  
  // Use memory store as fallback
  return undefined; // express-rate-limit uses memory store by default when store is undefined
}

/**
 * Standard API rate limiter (IP-based)
 * Applies to all API routes by default
 */
const standardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 requests per hour per IP
  standardHeaders: config.rateLimit.standardHeaders,
  legacyHeaders: config.rateLimit.legacyHeaders,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
    data: null
  },
  store: createStore('standard'),
  keyGenerator: (req) => {
    return `${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for health check and metrics endpoints
    return req.path.includes('/health') || req.path.includes('/metrics');
  }
});

/**
 * Strict API rate limiter (IP-based)
 * For sensitive routes like authentication
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
    data: null
  },
  store: createStore('strict'),
  keyGenerator: (req) => {
    return `${req.ip}`;
  }
});

/**
 * User-based rate limiter
 * Limits requests per user ID
 */
const userLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour per user ID
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this user, please try again later.',
    data: null
  },
  store: createStore('user'),
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for health check and metrics endpoints
    return req.path.includes('/health') || req.path.includes('/metrics');
  }
});

/**
 * AI request rate limiter
 * Specifically for AI-related endpoints
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 AI requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'AI request limit reached, please try again later.',
    data: null
  },
  store: createStore('ai'),
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
});

// In-memory abuse tracking as fallback when Redis is unavailable
const abuseTracker = {
  counts: new Map(),
  blocked: new Map(),
  
  increment(key) {
    const count = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, count);
    
    // Set expiry by scheduling cleanup
    setTimeout(() => {
      this.counts.delete(key);
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    return count;
  },
  
  isBlocked(key) {
    return this.blocked.has(key);
  },
  
  block(key) {
    this.blocked.set(key, true);
    
    // Set expiry by scheduling cleanup
    setTimeout(() => {
      this.blocked.delete(key);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
};

/**
 * Abuse detection middleware
 * Tracks suspicious behavior and blocks if threshold is exceeded
 */
function abuseDetection() {
  const ABUSE_THRESHOLD = 10; // Number of suspicious actions before blocking
  const ABUSE_WINDOW = 24 * 60 * 60; // 24 hours (in seconds)
  
  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const userId = req.user ? req.user.id : null;
      const key = userId ? `abuse:user:${userId}` : `abuse:ip:${ip}`;
      
      // Check if already blocked
      let isBlocked = false;
      
      if (redisAvailable && redisClient) {
        isBlocked = await redisClient.get(`${key}:blocked`);
      } else {
        isBlocked = abuseTracker.isBlocked(key);
      }
      
      if (isBlocked) {
        logger.warn('Blocked suspicious activity', {
          ip,
          userId,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json({
          status: 'error',
          message: 'Access temporarily blocked due to suspicious activity.',
          data: null
        });
      }
      
      // Continue with the request
      next();
      
      // After the response is sent, check for suspicious patterns
      res.on('finish', async () => {
        // Only track 4xx and 5xx responses
        if (res.statusCode >= 400) {
          let count;
          
          // Increment the counter
          if (redisAvailable && redisClient) {
            count = await redisClient.incr(key);
            
            // Set expiry if this is the first increment
            if (count === 1) {
              await redisClient.expire(key, ABUSE_WINDOW);
            }
          } else {
            count = abuseTracker.increment(key);
          }
          
          // If threshold exceeded, block the IP/user
          if (count >= ABUSE_THRESHOLD) {
            if (redisAvailable && redisClient) {
              await redisClient.set(`${key}:blocked`, '1', 'EX', ABUSE_WINDOW);
            } else {
              abuseTracker.block(key);
            }
            
            logger.warn('Abuse threshold exceeded, blocking access', {
              ip,
              userId,
              count,
              statusCode: res.statusCode,
              path: req.path,
              method: req.method
            });
          }
        }
      });
    } catch (error) {
      // If Redis fails, log but don't block the request
      logger.error('Abuse detection error', { error: error.message });
      next();
    }
  };
}

// Check if Redis is available
const isRedisAvailable = () => {
  return redisAvailable;
};

module.exports = {
  initializeRedis,
  isRedisAvailable,
  standardLimiter,
  strictLimiter,
  userLimiter,
  aiLimiter,
  abuseDetection
};
