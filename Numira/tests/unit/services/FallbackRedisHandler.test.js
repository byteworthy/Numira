/**
 * Unit Tests for Fallback Redis Handler Service
 */

const FallbackRedisHandler = require('../../../services/FallbackRedisHandler');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('FallbackRedisHandler Service', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new FallbackRedisHandler();
  });

  describe('constructor', () => {
    it('should initialize with empty storage', () => {
      expect(handler.storage).toEqual({});
      expect(handler.expirations).toEqual({});
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await handler.get('nonexistent-key');
      expect(result).toBeNull();
    });

    it('should return value for existing key', async () => {
      handler.storage['test-key'] = 'test-value';
      
      const result = await handler.get('test-key');
      
      expect(result).toBe('test-value');
    });

    it('should return null for expired key', async () => {
      // Set up an expired key
      handler.storage['expired-key'] = 'expired-value';
      handler.expirations['expired-key'] = Date.now() - 1000; // 1 second ago
      
      const result = await handler.get('expired-key');
      
      expect(result).toBeNull();
      expect(handler.storage['expired-key']).toBeUndefined();
      expect(handler.expirations['expired-key']).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock storage to throw an error
      jest.spyOn(handler, 'checkExpiration').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.get('test-key');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.get', {
        error: expect.any(Error),
        key: 'test-key'
      });
    });
  });

  describe('set', () => {
    it('should set value without expiration', async () => {
      await handler.set('test-key', 'test-value');
      
      expect(handler.storage['test-key']).toBe('test-value');
      expect(handler.expirations['test-key']).toBeUndefined();
    });

    it('should set value with expiration', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      await handler.set('test-key', 'test-value', 60); // 60 seconds
      
      expect(handler.storage['test-key']).toBe('test-value');
      expect(handler.expirations['test-key']).toBe(now + 60000);
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(handler.storage, 'hasOwnProperty').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      await handler.set('test-key', 'test-value');
      
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.set', {
        error: expect.any(Error),
        key: 'test-key'
      });
    });

    it('should return "OK" on success', async () => {
      const result = await handler.set('test-key', 'test-value');
      
      expect(result).toBe('OK');
    });
  });

  describe('del', () => {
    it('should delete existing key', async () => {
      handler.storage['test-key'] = 'test-value';
      handler.expirations['test-key'] = Date.now() + 60000;
      
      const result = await handler.del('test-key');
      
      expect(result).toBe(1);
      expect(handler.storage['test-key']).toBeUndefined();
      expect(handler.expirations['test-key']).toBeUndefined();
    });

    it('should return 0 for non-existent key', async () => {
      const result = await handler.del('nonexistent-key');
      
      expect(result).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(handler.storage, 'hasOwnProperty').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.del('test-key');
      
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.del', {
        error: expect.any(Error),
        key: 'test-key'
      });
    });
  });

  describe('incr', () => {
    it('should increment existing numeric value', async () => {
      handler.storage['counter'] = '5';
      
      const result = await handler.incr('counter');
      
      expect(result).toBe(6);
      expect(handler.storage['counter']).toBe('6');
    });

    it('should initialize non-existent key to 1', async () => {
      const result = await handler.incr('new-counter');
      
      expect(result).toBe(1);
      expect(handler.storage['new-counter']).toBe('1');
    });

    it('should handle non-numeric values', async () => {
      handler.storage['text-key'] = 'not-a-number';
      
      const result = await handler.incr('text-key');
      
      expect(result).toBe(1);
      expect(handler.storage['text-key']).toBe('1');
      expect(logger.warn).toHaveBeenCalledWith('Non-numeric value found in incr operation', {
        key: 'text-key',
        value: 'not-a-number'
      });
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(handler.storage, 'hasOwnProperty').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.incr('counter');
      
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.incr', {
        error: expect.any(Error),
        key: 'counter'
      });
    });
  });

  describe('expire', () => {
    it('should set expiration for existing key', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      handler.storage['test-key'] = 'test-value';
      
      const result = await handler.expire('test-key', 60); // 60 seconds
      
      expect(result).toBe(1);
      expect(handler.expirations['test-key']).toBe(now + 60000);
    });

    it('should return 0 for non-existent key', async () => {
      const result = await handler.expire('nonexistent-key', 60);
      
      expect(result).toBe(0);
      expect(handler.expirations['nonexistent-key']).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(handler.storage, 'hasOwnProperty').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.expire('test-key', 60);
      
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.expire', {
        error: expect.any(Error),
        key: 'test-key',
        seconds: 60
      });
    });
  });

  describe('checkExpiration', () => {
    it('should remove expired keys', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      // Set up an expired key
      handler.storage['expired-key'] = 'expired-value';
      handler.expirations['expired-key'] = now - 1000; // 1 second ago
      
      // Set up a non-expired key
      handler.storage['valid-key'] = 'valid-value';
      handler.expirations['valid-key'] = now + 60000; // 60 seconds in future
      
      handler.checkExpiration('expired-key');
      handler.checkExpiration('valid-key');
      
      expect(handler.storage['expired-key']).toBeUndefined();
      expect(handler.expirations['expired-key']).toBeUndefined();
      expect(handler.storage['valid-key']).toBe('valid-value');
      expect(handler.expirations['valid-key']).toBe(now + 60000);
    });

    it('should do nothing for keys without expiration', () => {
      handler.storage['test-key'] = 'test-value';
      
      handler.checkExpiration('test-key');
      
      expect(handler.storage['test-key']).toBe('test-value');
    });
  });

  describe('keys', () => {
    it('should return all keys matching pattern', async () => {
      handler.storage['user:1'] = 'data1';
      handler.storage['user:2'] = 'data2';
      handler.storage['post:1'] = 'post1';
      
      const result = await handler.keys('user:*');
      
      expect(result).toEqual(['user:1', 'user:2']);
    });

    it('should return empty array for no matches', async () => {
      handler.storage['user:1'] = 'data1';
      
      const result = await handler.keys('post:*');
      
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(Object, 'keys').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.keys('user:*');
      
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.keys', {
        error: expect.any(Error),
        pattern: 'user:*'
      });
    });
  });

  describe('flushall', () => {
    it('should clear all storage and expirations', async () => {
      handler.storage['key1'] = 'value1';
      handler.storage['key2'] = 'value2';
      handler.expirations['key1'] = Date.now() + 60000;
      
      const result = await handler.flushall();
      
      expect(result).toBe('OK');
      expect(handler.storage).toEqual({});
      expect(handler.expirations).toEqual({});
    });

    it('should handle errors gracefully', async () => {
      // Force an error
      jest.spyOn(handler, 'storage', 'get').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await handler.flushall();
      
      expect(result).toBe('OK'); // Still returns OK
      expect(logger.error).toHaveBeenCalledWith('Error in FallbackRedisHandler.flushall', {
        error: expect.any(Error)
      });
    });
  });
});
