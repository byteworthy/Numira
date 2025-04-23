/**
 * Unit tests for the Cache Service
 * 
 * Tests the functionality of the Redis-based caching service.
 */

const cacheService = require('../../../services/cacheService');
const Redis = require('ioredis');

// Mock Redis client
jest.mock('ioredis');

describe('Cache Service', () => {
  let mockRedisClient;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock Redis client
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['key1', 'key2']),
      flushdb: jest.fn().mockResolvedValue('OK'),
      info: jest.fn().mockResolvedValue('redis_version:6.0.0'),
      dbsize: jest.fn().mockResolvedValue(10),
      on: jest.fn()
    };
    
    // Mock Redis constructor to return our mock client
    Redis.mockImplementation(() => mockRedisClient);
  });
  
  describe('generateCacheKey', () => {
    test('should generate consistent cache keys', () => {
      const key1 = cacheService.generateCacheKey('test', { a: 1, b: 2 });
      const key2 = cacheService.generateCacheKey('test', { b: 2, a: 1 });
      
      // Keys should be the same regardless of object property order
      expect(key1).toBe(key2);
    });
    
    test('should include prefix in the key', () => {
      const key = cacheService.generateCacheKey('prefix', { a: 1 });
      expect(key.startsWith('prefix:')).toBe(true);
    });
  });
  
  describe('set', () => {
    test('should set cache value with TTL', async () => {
      await cacheService.set('test-key', { data: 'test' }, 60);
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' }),
        'EX',
        60
      );
    });
    
    test('should set cache value without TTL', async () => {
      await cacheService.set('test-key', { data: 'test' }, 0);
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' })
      );
    });
    
    test('should handle errors', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.set('test-key', { data: 'test' });
      expect(result).toBe(false);
    });
  });
  
  describe('get', () => {
    test('should get and parse cached value', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      
      const result = await cacheService.get('test-key');
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'test' });
    });
    
    test('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await cacheService.get('non-existent');
      
      expect(result).toBeNull();
    });
    
    test('should handle parsing errors', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json');
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
    });
  });
  
  describe('del', () => {
    test('should delete cache key', async () => {
      const result = await cacheService.del('test-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });
    
    test('should handle errors', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.del('test-key');
      
      expect(result).toBe(false);
    });
  });
  
  describe('delByPattern', () => {
    test('should delete keys matching pattern', async () => {
      const result = await cacheService.delByPattern('test-*');
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test-*');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key1', 'key2');
      expect(result).toBe(true);
    });
    
    test('should handle no matching keys', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      
      const result = await cacheService.delByPattern('test-*');
      
      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    test('should handle errors', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.delByPattern('test-*');
      
      expect(result).toBe(false);
    });
  });
  
  describe('getOrSet', () => {
    test('should return cached value if exists', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));
      
      const fn = jest.fn().mockResolvedValue({ data: 'generated' });
      const result = await cacheService.getOrSet('test-key', fn);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(fn).not.toHaveBeenCalled();
      expect(result).toEqual({ data: 'cached' });
    });
    
    test('should generate and cache value if not exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      const fn = jest.fn().mockResolvedValue({ data: 'generated' });
      const result = await cacheService.getOrSet('test-key', fn, 60);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(fn).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'generated' }),
        'EX',
        60
      );
      expect(result).toEqual({ data: 'generated' });
    });
    
    test('should handle cache errors and fall back to function', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      const fn = jest.fn().mockResolvedValue({ data: 'generated' });
      const result = await cacheService.getOrSet('test-key', fn);
      
      expect(fn).toHaveBeenCalled();
      expect(result).toEqual({ data: 'generated' });
    });
  });
  
  describe('clear', () => {
    test('should clear all cache', async () => {
      const result = await cacheService.clear();
      
      expect(mockRedisClient.flushdb).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    test('should handle errors', async () => {
      mockRedisClient.flushdb.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.clear();
      
      expect(result).toBe(false);
    });
  });
  
  describe('getStats', () => {
    test('should return cache statistics', async () => {
      const result = await cacheService.getStats();
      
      expect(mockRedisClient.info).toHaveBeenCalled();
      expect(mockRedisClient.dbsize).toHaveBeenCalled();
      expect(result).toEqual({
        size: 10,
        info: 'redis_version:6.0.0'
      });
    });
    
    test('should handle errors', async () => {
      mockRedisClient.info.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.getStats();
      
      expect(result).toHaveProperty('error');
    });
  });
  
  describe('cachedAIResponse', () => {
    test('should use cache for AI responses', async () => {
      // Mock getOrSet to test cachedAIResponse
      const originalGetOrSet = cacheService.getOrSet;
      cacheService.getOrSet = jest.fn().mockResolvedValue('AI response');
      
      const generateFn = jest.fn();
      const result = await cacheService.cachedAIResponse(
        'user input',
        'persona1',
        'room1',
        generateFn
      );
      
      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toBe('AI response');
      
      // Restore original function
      cacheService.getOrSet = originalGetOrSet;
    });
  });
});
