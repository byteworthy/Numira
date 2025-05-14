/**
 * Unit Tests for Redis Connection Checker Utility
 */

const { checkRedisConnection, createRedisClient } = require('../../../utils/checkRedis');
const Redis = require('ioredis');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../../utils/logger');
jest.mock('../../../config/config', () => ({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'test-password',
    tls: false
  }
}));

describe('Redis Connection Checker Utility', () => {
  let mockRedisInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock Redis instance
    mockRedisInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn()
    };
    
    // Mock Redis constructor
    Redis.mockImplementation(() => mockRedisInstance);
  });

  describe('checkRedisConnection', () => {
    it('should return true when Redis is available', async () => {
      const result = await checkRedisConnection();
      
      expect(result).toBe(true);
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true
      });
      expect(mockRedisInstance.connect).toHaveBeenCalled();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Redis connection successful');
    });

    it('should return false when Redis connection fails', async () => {
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'));
      
      const result = await checkRedisConnection();
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Redis connection failed, using fallback mode', {
        error: 'Connection refused',
        host: 'localhost',
        port: 6379
      });
    });

    it('should return false when Redis ping fails', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));
      
      const result = await checkRedisConnection();
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should accept custom timeout parameter', async () => {
      await checkRedisConnection(2000);
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        connectTimeout: 2000
      }));
    });

    it('should register error handler on Redis client', async () => {
      await checkRedisConnection();
      
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('createRedisClient', () => {
    it('should create and return a Redis client', () => {
      const client = createRedisClient();
      
      expect(client).toBe(mockRedisInstance);
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        tls: undefined,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      });
    });

    it('should register error handler on Redis client', () => {
      createRedisClient();
      
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle TLS configuration', () => {
      // Temporarily modify config
      const originalTls = config.redis.tls;
      config.redis.tls = true;
      
      createRedisClient();
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        tls: {}
      }));
      
      // Restore config
      config.redis.tls = originalTls;
    });

    it('should return null when Redis client creation fails', () => {
      Redis.mockImplementation(() => {
        throw new Error('Failed to create client');
      });
      
      const client = createRedisClient();
      
      expect(client).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to create Redis client', { error: 'Failed to create client' });
    });

    it('should handle missing password', () => {
      // Temporarily modify config
      const originalPassword = config.redis.password;
      config.redis.password = null;
      
      createRedisClient();
      
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        password: undefined
      }));
      
      // Restore config
      config.redis.password = originalPassword;
    });
  });
});
