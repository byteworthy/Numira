/**
 * Unit tests for the Circuit Breaker Service
 * 
 * Tests the functionality of the circuit breaker pattern implementation.
 */

const circuitBreaker = require('../../../services/circuitBreaker');

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  }
}));

describe('Circuit Breaker Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset the module to clear any cached state
    jest.resetModules();
  });
  
  describe('createBreaker', () => {
    test('should create a new circuit breaker with default options', () => {
      const breaker = circuitBreaker.createBreaker('test-service');
      
      expect(breaker).toBeDefined();
      expect(breaker.execute).toBeDefined();
      expect(breaker.isOpen).toBeDefined();
      
      // Check initial state
      expect(breaker.isOpen()).toBe(false);
    });
    
    test('should create a new circuit breaker with custom options', () => {
      const options = {
        failureThreshold: 3,
        resetTimeout: 5000,
        halfOpenSuccessThreshold: 1
      };
      
      const breaker = circuitBreaker.createBreaker('test-service', options);
      
      expect(breaker).toBeDefined();
    });
    
    test('should return the same breaker instance for the same name', () => {
      const breaker1 = circuitBreaker.createBreaker('same-service');
      const breaker2 = circuitBreaker.createBreaker('same-service');
      
      expect(breaker1).toBe(breaker2);
    });
  });
  
  describe('execute', () => {
    test('should execute function when circuit is closed', async () => {
      const breaker = circuitBreaker.createBreaker('test-execute');
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(mockFn);
      
      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('success');
    });
    
    test('should reject when circuit is open', async () => {
      const breaker = circuitBreaker.createBreaker('test-open', {
        failureThreshold: 1,
        resetTimeout: 10000
      });
      
      // Force the circuit to open
      const mockError = new Error('Test error');
      const mockFailFn = jest.fn().mockRejectedValue(mockError);
      
      // First call should fail and open the circuit
      await expect(breaker.execute(mockFailFn)).rejects.toThrow(mockError);
      
      // Second call should be rejected with circuit open error
      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow(/circuit.*open/i);
    });
    
    test('should transition to half-open after reset timeout', async () => {
      jest.useFakeTimers();
      
      const resetTimeout = 1000; // 1 second
      const breaker = circuitBreaker.createBreaker('test-half-open', {
        failureThreshold: 1,
        resetTimeout
      });
      
      // Force the circuit to open
      const mockFailFn = jest.fn().mockRejectedValue(new Error('Test error'));
      await expect(breaker.execute(mockFailFn)).rejects.toThrow();
      
      // Circuit should be open
      expect(breaker.isOpen()).toBe(true);
      
      // Advance time past the reset timeout
      jest.advanceTimersByTime(resetTimeout + 100);
      
      // Next execution should be allowed (half-open state)
      const mockSuccessFn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(mockSuccessFn);
      
      expect(mockSuccessFn).toHaveBeenCalled();
      expect(result).toBe('success');
      
      // Circuit should be closed after successful execution in half-open state
      expect(breaker.isOpen()).toBe(false);
      
      jest.useRealTimers();
    });
    
    test('should reopen circuit on failure in half-open state', async () => {
      jest.useFakeTimers();
      
      const resetTimeout = 1000; // 1 second
      const breaker = circuitBreaker.createBreaker('test-reopen', {
        failureThreshold: 1,
        resetTimeout
      });
      
      // Force the circuit to open
      const mockFailFn = jest.fn().mockRejectedValue(new Error('Test error'));
      await expect(breaker.execute(mockFailFn)).rejects.toThrow();
      
      // Circuit should be open
      expect(breaker.isOpen()).toBe(true);
      
      // Advance time past the reset timeout
      jest.advanceTimersByTime(resetTimeout + 100);
      
      // Next execution should fail again
      await expect(breaker.execute(mockFailFn)).rejects.toThrow();
      
      // Circuit should be open again
      expect(breaker.isOpen()).toBe(true);
      
      jest.useRealTimers();
    });
    
    test('should require multiple successes in half-open state to close circuit', async () => {
      jest.useFakeTimers();
      
      const resetTimeout = 1000; // 1 second
      const halfOpenSuccessThreshold = 2;
      const breaker = circuitBreaker.createBreaker('test-multiple-success', {
        failureThreshold: 1,
        resetTimeout,
        halfOpenSuccessThreshold
      });
      
      // Force the circuit to open
      const mockFailFn = jest.fn().mockRejectedValue(new Error('Test error'));
      await expect(breaker.execute(mockFailFn)).rejects.toThrow();
      
      // Advance time past the reset timeout
      jest.advanceTimersByTime(resetTimeout + 100);
      
      // First success in half-open state
      const mockSuccessFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(mockSuccessFn);
      
      // Circuit should still be in half-open state
      expect(breaker.isOpen()).toBe(false);
      
      // Second success in half-open state
      await breaker.execute(mockSuccessFn);
      
      // Circuit should now be closed
      expect(breaker.isOpen()).toBe(false);
      
      jest.useRealTimers();
    });
  });
  
  describe('resetBreaker', () => {
    test('should reset a specific circuit breaker', () => {
      const breaker = circuitBreaker.createBreaker('test-reset');
      
      // Force the circuit to open
      const mockFailFn = jest.fn().mockRejectedValue(new Error('Test error'));
      breaker.onFailure(new Error('Test error'));
      breaker.onFailure(new Error('Test error'));
      breaker.onFailure(new Error('Test error'));
      breaker.onFailure(new Error('Test error'));
      breaker.onFailure(new Error('Test error'));
      
      // Circuit should be open
      expect(breaker.isOpen()).toBe(true);
      
      // Reset the breaker
      const result = circuitBreaker.resetBreaker('test-reset');
      
      // Reset should return true
      expect(result).toBe(true);
      
      // Circuit should be closed
      expect(breaker.isOpen()).toBe(false);
    });
    
    test('should return false when resetting non-existent breaker', () => {
      const result = circuitBreaker.resetBreaker('non-existent');
      
      expect(result).toBe(false);
    });
  });
  
  describe('resetAllBreakers', () => {
    test('should reset all circuit breakers', () => {
      // Create multiple breakers
      const breaker1 = circuitBreaker.createBreaker('test-reset-all-1');
      const breaker2 = circuitBreaker.createBreaker('test-reset-all-2');
      
      // Force both circuits to open
      breaker1.onFailure(new Error('Test error'));
      breaker1.onFailure(new Error('Test error'));
      breaker1.onFailure(new Error('Test error'));
      breaker1.onFailure(new Error('Test error'));
      breaker1.onFailure(new Error('Test error'));
      
      breaker2.onFailure(new Error('Test error'));
      breaker2.onFailure(new Error('Test error'));
      breaker2.onFailure(new Error('Test error'));
      breaker2.onFailure(new Error('Test error'));
      breaker2.onFailure(new Error('Test error'));
      
      // Both circuits should be open
      expect(breaker1.isOpen()).toBe(true);
      expect(breaker2.isOpen()).toBe(true);
      
      // Reset all breakers
      circuitBreaker.resetAllBreakers();
      
      // Both circuits should be closed
      expect(breaker1.isOpen()).toBe(false);
      expect(breaker2.isOpen()).toBe(false);
    });
  });
  
  describe('getAllBreakers', () => {
    test('should return status of all circuit breakers', () => {
      // Create multiple breakers
      circuitBreaker.createBreaker('test-get-all-1');
      circuitBreaker.createBreaker('test-get-all-2');
      
      const status = circuitBreaker.getAllBreakers();
      
      expect(status).toBeDefined();
      expect(status['test-get-all-1']).toBeDefined();
      expect(status['test-get-all-2']).toBeDefined();
    });
  });
});
