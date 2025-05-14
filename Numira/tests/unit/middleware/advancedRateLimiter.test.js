/**
 * Unit Tests for Advanced Rate Limiter Middleware
 */

const advancedRateLimiter = require('../../../middleware/advancedRateLimiter');
const logger = require('../../../utils/logger');
const redis = require('redis');

// Mock dependencies
jest.mock('../../../utils/logger');
jest.mock('redis');

describe('Advanced Rate Limiter Middleware', () => {
  let req;
  let res;
  let next;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      user: {
        id: 'user123',
        role: 'user'
      },
      headers: {
        'x-forwarded-for': '192.168.1.1'
      }
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
    
    // Mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('1'),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK')
    };
    
    // Mock Redis constructor
    redis.createClient.mockReturnValue(mockRedisClient);
    
    // Reset the module state
    jest.isolateModules(() => {
      jest.resetModules();
    });
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter middleware with default options', () => {
      const middleware = advancedRateLimiter.createRateLimiter();
      
      expect(middleware).toBeInstanceOf(Function);
    });

    it('should create a rate limiter middleware with custom options', () => {
      const options = {
        windowMs: 60000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip,
        handler: (req, res) => res.status(429).json({ error: 'Too many requests' })
      };
      
      const middleware = advancedRateLimiter.createRateLimiter(options);
      
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('apiLimiter', () => {
    it('should call next() when under rate limit', async () => {
      // Mock Redis client to return a count under the limit
      mockRedisClient.incr.mockResolvedValue(5);
      
      const middleware = advancedRateLimiter.apiLimiter;
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': expect.any(Number),
        'X-RateLimit-Remaining': expect.any(Number),
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Mock Redis client to return a count over the limit
      mockRedisClient.incr.mockResolvedValue(101);
      
      const middleware = advancedRateLimiter.apiLimiter;
      await middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests, please try again later'
      });
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': expect.any(Number),
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': expect.any(Number),
        'Retry-After': expect.any(Number)
      });
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: req.user.id
      });
    });

    it('should use different rate limits for different user roles', async () => {
      // Set user role to premium
      req.user.role = 'premium';
      
      // Mock Redis client to return a count that would exceed normal limit but not premium limit
      mockRedisClient.incr.mockResolvedValue(120);
      
      const middleware = advancedRateLimiter.apiLimiter;
      await middleware(req, res, next);
      
      // Should not be rate limited because premium users have higher limits
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should use IP address as key when user is not authenticated', async () => {
      // Remove user object
      delete req.user;
      
      const middleware = advancedRateLimiter.apiLimiter;
      await middleware(req, res, next);
      
      // Should use IP-based rate limiting
      expect(mockRedisClient.incr).toHaveBeenCalledWith(expect.stringContaining(req.ip));
      expect(next).toHaveBeenCalled();
    });

    it('should use X-Forwarded-For header when available', async () => {
      // Set up middleware to use X-Forwarded-For
      const options = {
        trustProxy: true
      };
      
      const middleware = advancedRateLimiter.createRateLimiter(options);
      await middleware(req, res, next);
      
      // Should use X-Forwarded-For IP
      expect(mockRedisClient.incr).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));
      expect(next).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock Redis client to throw an error
      mockRedisClient.incr.mockRejectedValue(new Error('Redis error'));
      
      const middleware = advancedRateLimiter.apiLimiter;
      await middleware(req, res, next);
      
      // Should still allow the request through
      expect(next).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Rate limiter Redis error', {
        error: expect.any(Error)
      });
    });
  });

  describe('authLimiter', () => {
    it('should have stricter limits than apiLimiter', () => {
      expect(advancedRateLimiter.authLimiter.windowMs).toBeLessThanOrEqual(advancedRateLimiter.apiLimiter.windowMs);
      expect(advancedRateLimiter.authLimiter.max).toBeLessThanOrEqual(advancedRateLimiter.apiLimiter.max);
    });
  });

  describe('createRedisStore', () => {
    it('should create a Redis store for rate limiting', () => {
      const store = advancedRateLimiter.createRedisStore();
      
      expect(store).toBeDefined();
      expect(redis.createClient).toHaveBeenCalled();
    });

    it('should handle Redis connection errors', async () => {
      // Mock Redis client to throw on connect
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      
      const store = advancedRateLimiter.createRedisStore();
      
      // Test the increment method with error handling
      await store.increment('test-key');
      
      expect(logger.error).toHaveBeenCalledWith('Rate limiter Redis connection error', {
        error: expect.any(Error)
      });
    });
  });

  describe('getKeyGenerator', () => {
    it('should generate key based on user ID when available', () => {
      const keyGenerator = advancedRateLimiter.getKeyGenerator();
      const key = keyGenerator(req);
      
      expect(key).toContain(req.user.id);
      expect(key).toContain(req.path);
    });

    it('should generate key based on IP when user ID is not available', () => {
      delete req.user;
      
      const keyGenerator = advancedRateLimiter.getKeyGenerator();
      const key = keyGenerator(req);
      
      expect(key).toContain(req.ip);
      expect(key).toContain(req.path);
    });

    it('should use custom key prefix when provided', () => {
      const keyGenerator = advancedRateLimiter.getKeyGenerator('custom:');
      const key = keyGenerator(req);
      
      expect(key).toContain('custom:');
    });
  });

  describe('getHandler', () => {
    it('should return a handler function that returns 429 status', () => {
      const handler = advancedRateLimiter.getHandler();
      
      handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests, please try again later'
      });
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: req.user.id
      });
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom rate limit message';
      const handler = advancedRateLimiter.getHandler(customMessage);
      
      handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: customMessage
      });
    });
  });

  describe('getRoleBasedMaxRequests', () => {
    it('should return higher limit for admin users', () => {
      req.user.role = 'admin';
      
      const maxRequests = advancedRateLimiter.getRoleBasedMaxRequests(req);
      
      expect(maxRequests).toBeGreaterThan(advancedRateLimiter.DEFAULT_MAX_REQUESTS);
    });

    it('should return higher limit for premium users', () => {
      req.user.role = 'premium';
      
      const maxRequests = advancedRateLimiter.getRoleBasedMaxRequests(req);
      
      expect(maxRequests).toBeGreaterThan(advancedRateLimiter.DEFAULT_MAX_REQUESTS);
    });

    it('should return default limit for regular users', () => {
      const maxRequests = advancedRateLimiter.getRoleBasedMaxRequests(req);
      
      expect(maxRequests).toBe(advancedRateLimiter.DEFAULT_MAX_REQUESTS);
    });

    it('should return default limit when user is not authenticated', () => {
      delete req.user;
      
      const maxRequests = advancedRateLimiter.getRoleBasedMaxRequests(req);
      
      expect(maxRequests).toBe(advancedRateLimiter.DEFAULT_MAX_REQUESTS);
    });
  });

  describe('skipRateLimiting', () => {
    it('should return true for admin users when skipForAdmins is true', () => {
      req.user.role = 'admin';
      
      const result = advancedRateLimiter.skipRateLimiting(req, { skipForAdmins: true });
      
      expect(result).toBe(true);
    });

    it('should return false for admin users when skipForAdmins is false', () => {
      req.user.role = 'admin';
      
      const result = advancedRateLimiter.skipRateLimiting(req, { skipForAdmins: false });
      
      expect(result).toBe(false);
    });

    it('should return false for non-admin users', () => {
      const result = advancedRateLimiter.skipRateLimiting(req, { skipForAdmins: true });
      
      expect(result).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      delete req.user;
      
      const result = advancedRateLimiter.skipRateLimiting(req, { skipForAdmins: true });
      
      expect(result).toBe(false);
    });
  });
});
