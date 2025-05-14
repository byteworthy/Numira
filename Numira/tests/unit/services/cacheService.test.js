/**
 * Unit Tests for Cache Service
 */

const cacheService = require('../../../services/cacheService');
const redis = require('redis');
const logger = require('../../../utils/logger');
const FallbackRedisHandler = require('../../../services/FallbackRedisHandler');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('redis');
jest.mock('../../../utils/logger');
jest.mock('../../../services/FallbackRedisHandler');
jest.mock('../../../config/config', () => ({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'test-password'
  },
  cache: {
    defaultTTL: 3600, // 1 hour
    namespaces: {
      user: 'user:',
      session: 'session:',
      conversation: 'conversation:'
    }
  }
}));

describe('Cache Service', () => {
  let mockRedisClient;
  const key = 'test-key';
  const namespace = 'user:';
  const fullKey = `${namespace}${key}`;
  const value = { id: 'test123', name: 'Test User' };
  const stringValue = JSON.stringify(value);
  const ttl = 3600;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(stringValue),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(ttl),
      keys: jest.fn().mockResolvedValue([fullKey]),
      flushDb: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn()
    };
    
    // Mock Redis constructor
    redis.createClient.mockReturnValue(mockRedisClient);
    
    // Mock FallbackRedisHandler
    FallbackRedisHandler.mockImplementation(() => ({
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(stringValue),
      del: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(true),
      expire: jest.fn().mockResolvedValue(true),
      ttl: jest.fn().mockResolvedValue(ttl),
      keys: jest.fn().mockResolvedValue([fullKey]),
      flushAll: jest.fn().mockResolvedValue(true)
    }));
  });

  describe('initialization', () => {
    it('should initialize Redis client', async () => {
      await cacheService.initialize();
      
      expect(redis.createClient).toHaveBeenCalledWith({
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        password: config.redis.password
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle Redis connection errors', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      
      await cacheService.initialize();
      
      expect(logger.warn).toHaveBeenCalledWith('Redis connection failed, using fallback handler', {
        error: expect.any(Error)
      });
      expect(FallbackRedisHandler).toHaveBeenCalled();
    });

    it('should log Redis errors', async () => {
      await cacheService.initialize();
      
      // Get the error handler function
      const errorHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'error')[1];
      
      // Simulate an error
      const error = new Error('Redis error');
      errorHandler(error);
      
      expect(logger.error).toHaveBeenCalledWith('Redis client error', {
        error
      });
    });
  });

  describe('set', () => {
    it('should set a value in the cache', async () => {
      await cacheService.initialize();
      const result = await cacheService.set(namespace, key, value);
      
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        fullKey,
        stringValue,
        { EX: config.cache.defaultTTL }
      );
    });

    it('should set a value with custom TTL', async () => {
      await cacheService.initialize();
      const customTTL = 7200;
      const result = await cacheService.set(namespace, key, value, customTTL);
      
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        fullKey,
        stringValue,
        { EX: customTTL }
      );
    });

    it('should handle non-JSON values', async () => {
      await cacheService.initialize();
      const stringOnlyValue = 'simple string';
      const result = await cacheService.set(namespace, key, stringOnlyValue);
      
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        fullKey,
        JSON.stringify(stringOnlyValue),
        { EX: config.cache.defaultTTL }
      );
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.set(namespace, key, value);
      
      expect(result).toBe(true);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.set).toHaveBeenCalledWith(
        fullKey,
        stringValue,
        config.cache.defaultTTL
      );
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.set(namespace, key, value))
        .rejects.toThrow('Failed to set cache value');
      
      expect(logger.error).toHaveBeenCalledWith('Error setting cache value', {
        error: expect.any(Error),
        namespace,
        key,
        value
      });
    });
  });

  describe('get', () => {
    it('should get a value from the cache', async () => {
      await cacheService.initialize();
      const result = await cacheService.get(namespace, key);
      
      expect(result).toEqual(value);
      expect(mockRedisClient.get).toHaveBeenCalledWith(fullKey);
    });

    it('should return null for non-existent keys', async () => {
      await cacheService.initialize();
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await cacheService.get(namespace, key);
      
      expect(result).toBeNull();
    });

    it('should handle non-JSON values', async () => {
      await cacheService.initialize();
      const nonJsonValue = 'simple string';
      mockRedisClient.get.mockResolvedValue('"simple string"');
      
      const result = await cacheService.get(namespace, key);
      
      expect(result).toBe(nonJsonValue);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.get(namespace, key);
      
      expect(result).toEqual(value);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.get).toHaveBeenCalledWith(fullKey);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.get(namespace, key))
        .rejects.toThrow('Failed to get cache value');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting cache value', {
        error: expect.any(Error),
        namespace,
        key
      });
    });

    it('should handle JSON parse errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.get.mockResolvedValue('invalid json');
      
      const result = await cacheService.get(namespace, key);
      
      expect(result).toBe('invalid json');
      expect(logger.warn).toHaveBeenCalledWith('Failed to parse cached JSON value', {
        error: expect.any(Error),
        namespace,
        key,
        value: 'invalid json'
      });
    });
  });

  describe('del', () => {
    it('should delete a value from the cache', async () => {
      await cacheService.initialize();
      const result = await cacheService.del(namespace, key);
      
      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(fullKey);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.del(namespace, key);
      
      expect(result).toBe(true);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.del).toHaveBeenCalledWith(fullKey);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.del(namespace, key))
        .rejects.toThrow('Failed to delete cache value');
      
      expect(logger.error).toHaveBeenCalledWith('Error deleting cache value', {
        error: expect.any(Error),
        namespace,
        key
      });
    });
  });

  describe('exists', () => {
    it('should check if a key exists in the cache', async () => {
      await cacheService.initialize();
      const result = await cacheService.exists(namespace, key);
      
      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith(fullKey);
    });

    it('should return false for non-existent keys', async () => {
      await cacheService.initialize();
      mockRedisClient.exists.mockResolvedValue(0);
      
      const result = await cacheService.exists(namespace, key);
      
      expect(result).toBe(false);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.exists(namespace, key);
      
      expect(result).toBe(true);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.exists).toHaveBeenCalledWith(fullKey);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.exists(namespace, key))
        .rejects.toThrow('Failed to check cache key existence');
      
      expect(logger.error).toHaveBeenCalledWith('Error checking cache key existence', {
        error: expect.any(Error),
        namespace,
        key
      });
    });
  });

  describe('expire', () => {
    it('should set expiration time for a key', async () => {
      await cacheService.initialize();
      const customTTL = 7200;
      const result = await cacheService.expire(namespace, key, customTTL);
      
      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(fullKey, customTTL);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const customTTL = 7200;
      const result = await cacheService.expire(namespace, key, customTTL);
      
      expect(result).toBe(true);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.expire).toHaveBeenCalledWith(fullKey, customTTL);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.expire.mockRejectedValue(new Error('Redis error'));
      
      const customTTL = 7200;
      await expect(cacheService.expire(namespace, key, customTTL))
        .rejects.toThrow('Failed to set cache key expiration');
      
      expect(logger.error).toHaveBeenCalledWith('Error setting cache key expiration', {
        error: expect.any(Error),
        namespace,
        key,
        ttl: customTTL
      });
    });
  });

  describe('ttl', () => {
    it('should get remaining TTL for a key', async () => {
      await cacheService.initialize();
      const result = await cacheService.ttl(namespace, key);
      
      expect(result).toBe(ttl);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(fullKey);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.ttl(namespace, key);
      
      expect(result).toBe(ttl);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.ttl).toHaveBeenCalledWith(fullKey);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.ttl(namespace, key))
        .rejects.toThrow('Failed to get cache key TTL');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting cache key TTL', {
        error: expect.any(Error),
        namespace,
        key
      });
    });
  });

  describe('keys', () => {
    it('should get all keys in a namespace', async () => {
      await cacheService.initialize();
      const pattern = `${namespace}*`;
      const result = await cacheService.keys(namespace);
      
      expect(result).toEqual([key]);
      expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const pattern = `${namespace}*`;
      const result = await cacheService.keys(namespace);
      
      expect(result).toEqual([key]);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.keys).toHaveBeenCalledWith(pattern);
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.keys(namespace))
        .rejects.toThrow('Failed to get cache keys');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting cache keys', {
        error: expect.any(Error),
        namespace
      });
    });
  });

  describe('flushAll', () => {
    it('should flush all cache data', async () => {
      await cacheService.initialize();
      const result = await cacheService.flushAll();
      
      expect(result).toBe(true);
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });

    it('should use fallback handler when Redis is unavailable', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      await cacheService.initialize();
      
      const result = await cacheService.flushAll();
      
      expect(result).toBe(true);
      const fallbackInstance = FallbackRedisHandler.mock.instances[0];
      expect(fallbackInstance.flushAll).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.flushDb.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.flushAll())
        .rejects.toThrow('Failed to flush cache');
      
      expect(logger.error).toHaveBeenCalledWith('Error flushing cache', {
        error: expect.any(Error)
      });
    });
  });

  describe('close', () => {
    it('should close the Redis client', async () => {
      await cacheService.initialize();
      await cacheService.close();
      
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      await cacheService.initialize();
      mockRedisClient.quit.mockRejectedValue(new Error('Redis error'));
      
      await expect(cacheService.close())
        .rejects.toThrow('Failed to close Redis client');
      
      expect(logger.error).toHaveBeenCalledWith('Error closing Redis client', {
        error: expect.any(Error)
      });
    });

    it('should do nothing if Redis client is not initialized', async () => {
      await cacheService.close();
      
      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });
});
