/**
 * Enhanced Circuit Breaker Service
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * when external services are experiencing issues.
 * 
 * The circuit breaker has three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are immediately rejected
 * - HALF-OPEN: Testing if service has recovered, allows limited requests
 * 
 * Features:
 * - Granular error tracking (timeouts vs. token errors vs. other errors)
 * - Optimized timeout and threshold values
 * - Detailed Winston logging of circuit events
 * - Error type-specific circuit breaking
 */

const winston = require('winston');
const config = require('../config/config');
const logger = require('../utils/logger');

// Error types for more granular circuit breaking
const ErrorType = {
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  TOKEN_LIMIT: 'TOKEN_LIMIT',
  AUTHENTICATION: 'AUTHENTICATION',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN'
};

// Circuit breaker states
const State = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

// Store for all circuit breakers
const breakers = new Map();

/**
 * Circuit Breaker class
 */
class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * 
   * @param {string} name - Name of the service protected by this breaker
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms before attempting to half-open circuit
   * @param {number} options.halfOpenSuccessThreshold - Successes needed in half-open state to close
   * @param {number} options.errorThresholdPercentage - Percentage of failures that will open the circuit
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastStateChange = Date.now();
    this.lastError = null;
    this.errorCounts = {
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.RATE_LIMIT]: 0,
      [ErrorType.TOKEN_LIMIT]: 0,
      [ErrorType.AUTHENTICATION]: 0,
      [ErrorType.SERVER_ERROR]: 0,
      [ErrorType.NETWORK_ERROR]: 0,
      [ErrorType.UNKNOWN]: 0
    };
    
    // Configuration with defaults from config
    this.failureThreshold = options.failureThreshold || config.circuitBreaker?.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || config.circuitBreaker?.resetTimeout || 30000; // 30 seconds
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || config.circuitBreaker?.halfOpenSuccessThreshold || 2;
    this.errorThresholdPercentage = options.errorThresholdPercentage || config.circuitBreaker?.errorThresholdPercentage || 50;
    
    logger.info(`Circuit breaker created for ${name}`, {
      name,
      state: this.state,
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold,
      errorThresholdPercentage: this.errorThresholdPercentage
    });
  }
  
  /**
   * Execute a function with circuit breaker protection
   * 
   * @param {Function} fn - The function to execute
   * @returns {Promise<any>} - The result of the function
   * @throws {Error} - If the circuit is open or the function fails
   */
  async execute(fn) {
    // Check if circuit is open
    if (this.state === State.OPEN) {
      // Check if it's time to try half-open
      if ((Date.now() - this.lastStateChange) > this.resetTimeout) {
        this.toHalfOpen();
      } else {
        // Circuit is still open, fast fail
        const error = new Error(`Circuit for ${this.name} is open`);
        error.circuitBreaker = {
          name: this.name,
          state: this.state,
          lastError: this.lastError,
          openSince: this.lastStateChange,
          errorCounts: this.errorCounts
        };
        throw error;
      }
    }
    
    try {
      // Increment request count
      this.requestCount++;
      
      // Execute the function
      const result = await fn();
      
      // Handle success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error);
      
      // Re-throw the original error
      throw error;
    }
  }
  
  /**
   * Determine the type of error
   * 
   * @param {Error} error - The error to categorize
   * @returns {string} - The error type
   */
  categorizeError(error) {
    if (!error) return ErrorType.UNKNOWN;
    
    const message = error.message ? error.message.toLowerCase() : '';
    const status = error.status || (error.response && error.response.status);
    
    // Check for timeout errors
    if (message.includes('timeout') || message.includes('timed out') || error.code === 'ETIMEDOUT') {
      return ErrorType.TIMEOUT;
    }
    
    // Check for rate limit errors
    if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }
    
    // Check for token limit errors
    if (message.includes('token') && (message.includes('limit') || message.includes('exceed'))) {
      return ErrorType.TOKEN_LIMIT;
    }
    
    // Check for authentication errors
    if (status === 401 || status === 403 || message.includes('auth') || message.includes('key')) {
      return ErrorType.AUTHENTICATION;
    }
    
    // Check for server errors
    if (status >= 500 || message.includes('server error') || message.includes('internal error')) {
      return ErrorType.SERVER_ERROR;
    }
    
    // Check for network errors
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || message.includes('network')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    // Default to unknown
    return ErrorType.UNKNOWN;
  }
  
  /**
   * Handle successful execution
   */
  onSuccess() {
    if (this.state === State.HALF_OPEN) {
      this.successCount++;
      
      // If we've had enough successes, close the circuit
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.toClosed();
      }
    } else if (this.state === State.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }
  
  /**
   * Handle failed execution
   * 
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    // Categorize the error
    const errorType = this.categorizeError(error);
    
    // Increment error count for this type
    this.errorCounts[errorType]++;
    
    // Store error details
    this.lastError = {
      message: error.message,
      stack: error.stack,
      type: errorType,
      time: Date.now()
    };
    
    // Increment failure count
    this.failureCount++;
    
    if (this.state === State.HALF_OPEN) {
      // Any failure in half-open state opens the circuit again
      this.toOpen();
    } else if (this.state === State.CLOSED) {
      // Check if we've reached the threshold
      const failurePercentage = (this.failureCount / this.requestCount) * 100;
      
      if (this.failureCount >= this.failureThreshold || failurePercentage >= this.errorThresholdPercentage) {
        this.toOpen();
      }
    }
  }
  
  /**
   * Transition to CLOSED state
   */
  toClosed() {
    const previousState = this.state;
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastStateChange = Date.now();
    
    // Reset error counts
    Object.keys(this.errorCounts).forEach(key => {
      this.errorCounts[key] = 0;
    });
    
    logger.info(`Circuit breaker ${this.name} closed`, {
      name: this.name,
      previousState,
      newState: this.state,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Transition to OPEN state
   */
  toOpen() {
    const previousState = this.state;
    this.state = State.OPEN;
    this.lastStateChange = Date.now();
    
    logger.warn(`Circuit breaker ${this.name} opened`, {
      name: this.name,
      previousState,
      newState: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      failurePercentage: (this.failureCount / this.requestCount) * 100,
      errorCounts: this.errorCounts,
      lastError: this.lastError,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  toHalfOpen() {
    const previousState = this.state;
    this.state = State.HALF_OPEN;
    this.successCount = 0;
    this.lastStateChange = Date.now();
    
    logger.info(`Circuit breaker ${this.name} half-open`, {
      name: this.name,
      previousState,
      newState: this.state,
      openDuration: Date.now() - this.lastStateChange,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Check if the circuit is open
   * 
   * @returns {boolean} - True if the circuit is open
   */
  isOpen() {
    return this.state === State.OPEN;
  }
  
  /**
   * Get the current state of the circuit breaker
   * 
   * @returns {Object} - Circuit breaker state information
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastStateChange: this.lastStateChange,
      lastError: this.lastError,
      errorCounts: this.errorCounts,
      openDuration: this.state === State.OPEN ? Date.now() - this.lastStateChange : 0
    };
  }
  
  /**
   * Reset the circuit breaker to closed state
   */
  reset() {
    const previousState = this.state;
    this.toClosed();
    
    logger.info(`Circuit breaker ${this.name} manually reset`, {
      name: this.name,
      previousState,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create a new circuit breaker or return an existing one
 * 
 * @param {string} name - Name of the service protected by this breaker
 * @param {Object} options - Configuration options
 * @returns {CircuitBreaker} - The circuit breaker instance
 */
function createBreaker(name, options = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  
  return breakers.get(name);
}

/**
 * Get all circuit breakers
 * 
 * @returns {Object} - Map of all circuit breakers
 */
function getAllBreakers() {
  const result = {};
  
  for (const [name, breaker] of breakers.entries()) {
    result[name] = breaker.getState();
  }
  
  return result;
}

/**
 * Reset a specific circuit breaker
 * 
 * @param {string} name - Name of the circuit breaker to reset
 * @returns {boolean} - True if the breaker was found and reset
 */
function resetBreaker(name) {
  if (breakers.has(name)) {
    breakers.get(name).reset();
    return true;
  }
  
  return false;
}

/**
 * Reset all circuit breakers
 */
function resetAllBreakers() {
  for (const breaker of breakers.values()) {
    breaker.reset();
  }
}

module.exports = {
  createBreaker,
  getAllBreakers,
  resetBreaker,
  resetAllBreakers,
  State,
  ErrorType
};
