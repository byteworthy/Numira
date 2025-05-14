/**
 * Unit Tests for Circuit Breaker Service
 */

const circuitBreaker = require('../../../services/circuitBreaker');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('Circuit Breaker Service', () => {
  const serviceName = 'testService';
  const options = {
    failureThreshold: 3,
    resetTimeout: 10000,
    fallbackFunction: jest.fn().mockResolvedValue('fallback result')
  };
  
  let testCircuitBreaker;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset circuit breaker state
    circuitBreaker.resetAll();
    
    // Create a new circuit breaker for testing
    testCircuitBreaker = circuitBreaker.create(serviceName, options);
  });

  describe('create', () => {
    it('should create a new circuit breaker with default options', () => {
      const defaultCircuitBreaker = circuitBreaker.create('defaultService');
      
      expect(defaultCircuitBreaker).toBeDefined();
      expect(defaultCircuitBreaker.getState()).toBe('CLOSED');
      expect(defaultCircuitBreaker.getFailureCount()).toBe(0);
    });

    it('should create a new circuit breaker with custom options', () => {
      expect(testCircuitBreaker).toBeDefined();
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(0);
    });

    it('should return existing circuit breaker if already created', () => {
      const existingCircuitBreaker = circuitBreaker.create(serviceName);
      
      expect(existingCircuitBreaker).toBe(testCircuitBreaker);
    });
  });

  describe('get', () => {
    it('should get an existing circuit breaker', () => {
      const retrievedCircuitBreaker = circuitBreaker.get(serviceName);
      
      expect(retrievedCircuitBreaker).toBe(testCircuitBreaker);
    });

    it('should return null if circuit breaker does not exist', () => {
      const nonExistentCircuitBreaker = circuitBreaker.get('nonExistentService');
      
      expect(nonExistentCircuitBreaker).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute function when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await testCircuitBreaker.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(0);
    });

    it('should increment failure count when function fails', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(testCircuitBreaker.execute(fn)).rejects.toThrow('Test error');
      
      expect(fn).toHaveBeenCalled();
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith('Circuit breaker failure', {
        serviceName,
        failureCount: 1,
        error
      });
    });

    it('should trip circuit when failure threshold is reached', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      
      // First failure
      await expect(testCircuitBreaker.execute(fn)).rejects.toThrow('Test error');
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(1);
      
      // Second failure
      await expect(testCircuitBreaker.execute(fn)).rejects.toThrow('Test error');
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(2);
      
      // Third failure - should trip circuit
      await expect(testCircuitBreaker.execute(fn)).rejects.toThrow('Test error');
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      expect(testCircuitBreaker.getFailureCount()).toBe(3);
      expect(logger.error).toHaveBeenCalledWith('Circuit breaker tripped', {
        serviceName,
        failureCount: 3,
        resetTimeout: options.resetTimeout
      });
    });

    it('should use fallback function when circuit is open', async () => {
      // Trip the circuit
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      
      // Manually trip the circuit
      testCircuitBreaker.trip();
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      
      // Execute with circuit open
      const result = await testCircuitBreaker.execute(fn);
      
      expect(result).toBe('fallback result');
      expect(fn).not.toHaveBeenCalled();
      expect(options.fallbackFunction).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Circuit breaker using fallback', {
        serviceName
      });
    });

    it('should throw CircuitOpenError when circuit is open and no fallback provided', async () => {
      // Create circuit breaker without fallback
      const noFallbackCircuitBreaker = circuitBreaker.create('noFallbackService', {
        failureThreshold: 3,
        resetTimeout: 10000
      });
      
      // Trip the circuit
      noFallbackCircuitBreaker.trip();
      expect(noFallbackCircuitBreaker.getState()).toBe('OPEN');
      
      // Execute with circuit open
      const fn = jest.fn().mockResolvedValue('success');
      await expect(noFallbackCircuitBreaker.execute(fn))
        .rejects.toThrow('Circuit is OPEN for service: noFallbackService');
      
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset failure count on successful execution', async () => {
      const error = new Error('Test error');
      const failFn = jest.fn().mockRejectedValue(error);
      
      // First failure
      await expect(testCircuitBreaker.execute(failFn)).rejects.toThrow('Test error');
      expect(testCircuitBreaker.getFailureCount()).toBe(1);
      
      // Successful execution
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await testCircuitBreaker.execute(successFn);
      
      expect(result).toBe('success');
      expect(testCircuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('trip', () => {
    it('should manually trip the circuit', () => {
      testCircuitBreaker.trip();
      
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      expect(logger.warn).toHaveBeenCalledWith('Circuit breaker manually tripped', {
        serviceName
      });
    });
  });

  describe('reset', () => {
    it('should manually reset the circuit', () => {
      // Trip the circuit
      testCircuitBreaker.trip();
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      
      // Reset the circuit
      testCircuitBreaker.reset();
      
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(testCircuitBreaker.getFailureCount()).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Circuit breaker reset', {
        serviceName
      });
    });
  });

  describe('halfOpen', () => {
    it('should set circuit to half-open state', () => {
      testCircuitBreaker.halfOpen();
      
      expect(testCircuitBreaker.getState()).toBe('HALF_OPEN');
      expect(logger.info).toHaveBeenCalledWith('Circuit breaker half-open', {
        serviceName
      });
    });

    it('should allow one test request when in half-open state', async () => {
      // Set to half-open
      testCircuitBreaker.halfOpen();
      
      // Successful test request
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await testCircuitBreaker.execute(successFn);
      
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalled();
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(logger.info).toHaveBeenCalledWith('Circuit breaker closed after successful test request', {
        serviceName
      });
    });

    it('should trip circuit again if test request fails', async () => {
      // Set to half-open
      testCircuitBreaker.halfOpen();
      
      // Failed test request
      const error = new Error('Test error');
      const failFn = jest.fn().mockRejectedValue(error);
      
      await expect(testCircuitBreaker.execute(failFn)).rejects.toThrow('Test error');
      
      expect(failFn).toHaveBeenCalled();
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      expect(logger.warn).toHaveBeenCalledWith('Circuit breaker reopened after failed test request', {
        serviceName,
        error
      });
    });
  });

  describe('auto reset', () => {
    it('should automatically reset to half-open after reset timeout', async () => {
      jest.useFakeTimers();
      
      // Trip the circuit
      testCircuitBreaker.trip();
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      
      // Fast-forward time
      jest.advanceTimersByTime(options.resetTimeout);
      
      // Execute pending timers
      jest.runOnlyPendingTimers();
      
      expect(testCircuitBreaker.getState()).toBe('HALF_OPEN');
      
      jest.useRealTimers();
    });
  });

  describe('getStatus', () => {
    it('should return circuit breaker status', () => {
      const status = testCircuitBreaker.getStatus();
      
      expect(status).toEqual({
        serviceName,
        state: 'CLOSED',
        failureCount: 0,
        failureThreshold: options.failureThreshold,
        resetTimeout: options.resetTimeout,
        lastFailureTime: null,
        hasFallback: true
      });
    });

    it('should include last failure time when failures occur', async () => {
      const now = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => now);
      
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(testCircuitBreaker.execute(fn)).rejects.toThrow('Test error');
      
      const status = testCircuitBreaker.getStatus();
      
      expect(status.lastFailureTime).toEqual(now);
      
      global.Date.mockRestore();
    });
  });

  describe('getAllCircuitBreakers', () => {
    it('should return all circuit breakers', () => {
      // Create another circuit breaker
      circuitBreaker.create('anotherService');
      
      const allCircuitBreakers = circuitBreaker.getAllCircuitBreakers();
      
      expect(Object.keys(allCircuitBreakers)).toEqual([serviceName, 'anotherService']);
      expect(allCircuitBreakers[serviceName]).toBe(testCircuitBreaker);
    });
  });

  describe('getAllStatus', () => {
    it('should return status of all circuit breakers', () => {
      // Create another circuit breaker
      circuitBreaker.create('anotherService');
      
      const allStatus = circuitBreaker.getAllStatus();
      
      expect(allStatus.length).toBe(2);
      expect(allStatus[0].serviceName).toBe(serviceName);
      expect(allStatus[1].serviceName).toBe('anotherService');
    });
  });

  describe('resetAll', () => {
    it('should reset all circuit breakers', () => {
      // Create another circuit breaker and trip both
      const anotherCircuitBreaker = circuitBreaker.create('anotherService');
      testCircuitBreaker.trip();
      anotherCircuitBreaker.trip();
      
      expect(testCircuitBreaker.getState()).toBe('OPEN');
      expect(anotherCircuitBreaker.getState()).toBe('OPEN');
      
      // Reset all
      circuitBreaker.resetAll();
      
      expect(testCircuitBreaker.getState()).toBe('CLOSED');
      expect(anotherCircuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('remove', () => {
    it('should remove a circuit breaker', () => {
      circuitBreaker.remove(serviceName);
      
      expect(circuitBreaker.get(serviceName)).toBeNull();
    });
  });

  describe('removeAll', () => {
    it('should remove all circuit breakers', () => {
      // Create another circuit breaker
      circuitBreaker.create('anotherService');
      
      circuitBreaker.removeAll();
      
      expect(circuitBreaker.get(serviceName)).toBeNull();
      expect(circuitBreaker.get('anotherService')).toBeNull();
      expect(Object.keys(circuitBreaker.getAllCircuitBreakers())).toHaveLength(0);
    });
  });
});
