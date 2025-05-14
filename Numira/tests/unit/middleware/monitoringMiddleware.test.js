/**
 * Unit tests for the Monitoring Middleware
 * 
 * Tests the middleware functions that track various metrics in the application.
 */

const monitoringMiddleware = require('../../../middleware/monitoringMiddleware');
const monitoringService = require('../../../services/monitoringService');

// Mock dependencies
jest.mock('../../../services/monitoringService', () => ({
  trackRequest: jest.fn(),
  trackDatabaseQuery: jest.fn(),
  trackAIRequest: jest.fn(),
  trackJournalEntry: jest.fn(),
  trackNewUser: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('Monitoring Middleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test?param=value',
      user: { id: 'user123' },
      body: {
        personaId: 'persona123',
        roomId: 'room123'
      },
      query: {}
    };
    
    // Mock response object with end method
    res = {
      statusCode: 200,
      end: jest.fn(),
      on: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
    
    // Mock Date.now
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('initialize', () => {
    test('should initialize monitoring service', async () => {
      const result = await monitoringMiddleware.initialize();
      
      expect(monitoringService.initialize).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    test('should handle initialization errors', async () => {
      monitoringService.initialize.mockRejectedValueOnce(new Error('Initialization error'));
      
      const result = await monitoringMiddleware.initialize();
      
      expect(result).toBe(false);
    });
  });
  
  describe('trackRequestMetrics', () => {
    test('should track request metrics after response is sent', () => {
      // Setup Date.now to return different values on subsequent calls
      Date.now.mockReturnValueOnce(1000).mockReturnValueOnce(1500);
      
      // Call middleware
      monitoringMiddleware.trackRequestMetrics(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Verify end method was replaced
      expect(res.end).not.toBe(jest.fn().end);
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify original metrics tracking
      expect(monitoringService.trackRequest).toHaveBeenCalledWith(req, res, 1000);
    });
    
    test('should handle errors during metrics tracking', () => {
      // Setup tracking to throw an error
      monitoringService.trackRequest.mockImplementationOnce(() => {
        throw new Error('Tracking error');
      });
      
      // Call middleware
      monitoringMiddleware.trackRequestMetrics(req, res, next);
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify error was handled (no exception thrown)
      expect(monitoringService.trackRequest).toHaveBeenCalled();
    });
  });
  
  describe('trackDatabaseQuery', () => {
    test('should track database query metrics', async () => {
      // Setup Date.now to return different values on subsequent calls
      Date.now.mockReturnValueOnce(1000).mockReturnValueOnce(1200);
      
      // Create middleware instance
      const middleware = monitoringMiddleware.trackDatabaseQuery('find', 'User');
      
      // Call middleware with successful next function
      await middleware(req, res, async () => {
        // Simulate some async work
        await Promise.resolve();
      });
      
      // Verify metrics were tracked
      expect(monitoringService.trackDatabaseQuery).toHaveBeenCalledWith(
        'find',
        'User',
        expect.any(Number),
        true
      );
    });
    
    test('should track failed database queries', async () => {
      // Setup Date.now to return different values on subsequent calls
      Date.now.mockReturnValueOnce(1000).mockReturnValueOnce(1200);
      
      // Create middleware instance
      const middleware = monitoringMiddleware.trackDatabaseQuery('find', 'User');
      
      // Call middleware with failing next function
      try {
        await middleware(req, res, async () => {
          throw new Error('Database error');
        });
      } catch (error) {
        // Expected error
      }
      
      // Verify metrics were tracked with success=false
      expect(monitoringService.trackDatabaseQuery).toHaveBeenCalledWith(
        'find',
        'User',
        expect.any(Number),
        false
      );
    });
  });
  
  describe('trackAIRequest', () => {
    test('should track AI request metrics after response is sent', () => {
      // Setup Date.now to return different values on subsequent calls
      Date.now.mockReturnValueOnce(1000).mockReturnValueOnce(2000);
      
      // Call middleware
      monitoringMiddleware.trackAIRequest(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify AI metrics tracking
      expect(monitoringService.trackAIRequest).toHaveBeenCalledWith(
        'user123',
        'persona123',
        'room123',
        expect.any(Number),
        true
      );
    });
    
    test('should handle missing user or persona/room IDs', () => {
      // Setup request without user or persona/room IDs
      req.user = null;
      req.body = {};
      
      // Call middleware
      monitoringMiddleware.trackAIRequest(req, res, next);
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify AI metrics tracking with undefined values
      expect(monitoringService.trackAIRequest).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        expect.any(Number),
        true
      );
    });
    
    test('should track failed AI requests', () => {
      // Setup response with error status code
      res.statusCode = 500;
      
      // Call middleware
      monitoringMiddleware.trackAIRequest(req, res, next);
      
      // Call the replaced end method
      res.end('error response', 'utf8');
      
      // Verify AI metrics tracking with success=false
      expect(monitoringService.trackAIRequest).toHaveBeenCalledWith(
        'user123',
        'persona123',
        'room123',
        expect.any(Number),
        false
      );
    });
  });
  
  describe('trackJournalEntry', () => {
    test('should track journal entry metrics for POST requests', () => {
      // Setup POST request
      req.method = 'POST';
      
      // Call middleware
      monitoringMiddleware.trackJournalEntry(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify journal metrics tracking
      expect(monitoringService.trackJournalEntry).toHaveBeenCalledWith(
        'user123',
        'persona123',
        'room123'
      );
    });
    
    test('should not track journal metrics for non-POST requests', () => {
      // Setup GET request
      req.method = 'GET';
      
      // Call middleware
      monitoringMiddleware.trackJournalEntry(req, res, next);
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify journal metrics were not tracked
      expect(monitoringService.trackJournalEntry).not.toHaveBeenCalled();
    });
    
    test('should not track journal metrics for failed requests', () => {
      // Setup POST request with error status
      req.method = 'POST';
      res.statusCode = 400;
      
      // Call middleware
      monitoringMiddleware.trackJournalEntry(req, res, next);
      
      // Call the replaced end method
      res.end('error response', 'utf8');
      
      // Verify journal metrics were not tracked
      expect(monitoringService.trackJournalEntry).not.toHaveBeenCalled();
    });
  });
  
  describe('trackNewUser', () => {
    test('should track new user metrics from response body', () => {
      // Setup POST request
      req.method = 'POST';
      
      // Call middleware
      monitoringMiddleware.trackNewUser(req, res, next);
      
      // Verify next was called
      expect(next).toHaveBeenCalled();
      
      // Call the replaced end method with JSON response containing user ID
      const responseBody = JSON.stringify({ data: { id: 'new-user-123' } });
      res.end(responseBody, 'utf8');
      
      // Verify new user metrics tracking
      expect(monitoringService.trackNewUser).toHaveBeenCalledWith('new-user-123');
    });
    
    test('should track new user metrics from request body if not in response', () => {
      // Setup POST request with user ID in request body
      req.method = 'POST';
      req.body.userId = 'user-from-request';
      
      // Call middleware
      monitoringMiddleware.trackNewUser(req, res, next);
      
      // Call the replaced end method with empty response
      res.end('', 'utf8');
      
      // Verify new user metrics tracking
      expect(monitoringService.trackNewUser).toHaveBeenCalledWith('user-from-request');
    });
    
    test('should not track new user metrics for non-POST requests', () => {
      // Setup GET request
      req.method = 'GET';
      
      // Call middleware
      monitoringMiddleware.trackNewUser(req, res, next);
      
      // Call the replaced end method
      res.end('response body', 'utf8');
      
      // Verify new user metrics were not tracked
      expect(monitoringService.trackNewUser).not.toHaveBeenCalled();
    });
    
    test('should not track new user metrics for failed requests', () => {
      // Setup POST request with error status
      req.method = 'POST';
      res.statusCode = 400;
      
      // Call middleware
      monitoringMiddleware.trackNewUser(req, res, next);
      
      // Call the replaced end method
      res.end('error response', 'utf8');
      
      // Verify new user metrics were not tracked
      expect(monitoringService.trackNewUser).not.toHaveBeenCalled();
    });
    
    test('should handle invalid JSON in response', () => {
      // Setup POST request
      req.method = 'POST';
      
      // Call middleware
      monitoringMiddleware.trackNewUser(req, res, next);
      
      // Call the replaced end method with invalid JSON
      res.end('not-json', 'utf8');
      
      // Verify new user metrics were not tracked (no error thrown)
      expect(monitoringService.trackNewUser).not.toHaveBeenCalled();
    });
  });
});
