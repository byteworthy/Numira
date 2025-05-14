/**
 * Analytics Service Unit Tests
 * 
 * Tests the functionality of the analytics service, including event tracking,
 * data retrieval, and privacy protection features.
 */

const analyticsService = require('../../../services/analyticsService');
const logger = require('../../../utils/logger');
const db = require('../../../config/db');

// Mock dependencies
jest.mock('../../../utils/logger');
jest.mock('../../../config/db');

describe('Analytics Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock config with analytics enabled
    jest.spyOn(require('../../../config/config'), 'ANALYTICS_ENABLED', 'get').mockReturnValue(true);
    jest.spyOn(require('../../../config/config'), 'ANALYTICS_TRACK_CONTENT', 'get').mockReturnValue(false);
    jest.spyOn(require('../../../config/config'), 'ANALYTICS_FALLBACK_TO_MEMORY', 'get').mockReturnValue(true);
  });
  
  describe('trackEvent', () => {
    it('should track an event successfully', async () => {
      // Mock database query response
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      
      // Test data
      const category = analyticsService.CATEGORIES.USER_INTERACTION;
      const action = analyticsService.ACTIONS.PAGE_VIEW;
      const data = { page: '/dashboard' };
      const user = { id: 'user-123', role: 'user' };
      const options = { clientType: 'web', sessionId: 'session-123' };
      
      // Call the function
      const result = await analyticsService.trackEvent(category, action, data, user, options);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event.category).toBe(category);
      expect(result.event.action).toBe(action);
      expect(result.event.data).toEqual(data);
      expect(result.event.user).toBeDefined();
      expect(result.event.user.id).toBe(user.id);
      expect(db.query).toHaveBeenCalledTimes(1);
    });
    
    it('should not track if analytics is disabled', async () => {
      // Mock config with analytics disabled
      jest.spyOn(require('../../../config/config'), 'ANALYTICS_ENABLED', 'get').mockReturnValue(false);
      
      // Test data
      const category = analyticsService.CATEGORIES.USER_INTERACTION;
      const action = analyticsService.ACTIONS.PAGE_VIEW;
      
      // Call the function
      const result = await analyticsService.trackEvent(category, action);
      
      // Assertions
      expect(result.tracked).toBe(false);
      expect(result.reason).toBe('Analytics disabled globally');
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should not track if user has opted out', async () => {
      // Test data
      const category = analyticsService.CATEGORIES.USER_INTERACTION;
      const action = analyticsService.ACTIONS.PAGE_VIEW;
      const user = { id: 'user-123', analyticsOptOut: true };
      
      // Call the function
      const result = await analyticsService.trackEvent(category, action, {}, user);
      
      // Assertions
      expect(result.tracked).toBe(false);
      expect(result.reason).toBe('User opted out of analytics');
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should use in-memory storage if database fails', async () => {
      // Mock database query to fail
      db.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Test data
      const category = analyticsService.CATEGORIES.USER_INTERACTION;
      const action = analyticsService.ACTIONS.PAGE_VIEW;
      
      // Call the function
      const result = await analyticsService.trackEvent(category, action);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(result.result.fallback).toBe(true);
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('trackPageView', () => {
    it('should track a page view successfully', async () => {
      // Mock trackEvent function
      jest.spyOn(analyticsService, 'trackEvent').mockResolvedValueOnce({ tracked: true });
      
      // Test data
      const page = '/dashboard';
      const user = { id: 'user-123' };
      const options = { referrer: '/login' };
      
      // Call the function
      const result = await analyticsService.trackPageView(page, user, options);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        analyticsService.CATEGORIES.USER_INTERACTION,
        analyticsService.ACTIONS.PAGE_VIEW,
        { page, referrer: '/login' },
        user,
        options
      );
    });
  });
  
  describe('trackApiPerformance', () => {
    it('should track API performance successfully', async () => {
      // Mock trackEvent function
      jest.spyOn(analyticsService, 'trackEvent').mockResolvedValueOnce({ tracked: true });
      
      // Test data
      const endpoint = '/api/users';
      const responseTime = 150;
      const statusCode = 200;
      const options = { method: 'GET' };
      
      // Call the function
      const result = await analyticsService.trackApiPerformance(endpoint, responseTime, statusCode, options);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        analyticsService.CATEGORIES.PERFORMANCE,
        analyticsService.ACTIONS.PERFORMANCE_API,
        { endpoint, responseTime, statusCode, method: 'GET' },
        {},
        options
      );
    });
  });
  
  describe('trackError', () => {
    it('should track an error successfully', async () => {
      // Mock trackEvent function
      jest.spyOn(analyticsService, 'trackEvent').mockResolvedValueOnce({ tracked: true });
      
      // Test data
      const errorType = analyticsService.ACTIONS.ERROR_FRONTEND;
      const message = 'Something went wrong';
      const details = { stack: 'Error: Something went wrong\n    at file.js:10:15' };
      const user = { id: 'user-123' };
      const options = { url: '/dashboard', includeStack: true };
      
      // Call the function
      const result = await analyticsService.trackError(errorType, message, details, user, options);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalled();
      // The details should be sanitized
      const callArgs = analyticsService.trackEvent.mock.calls[0];
      expect(callArgs[2].details.stack).not.toContain('file.js:10:15');
    });
  });
  
  describe('trackConversation', () => {
    it('should track a conversation event without content', async () => {
      // Mock trackEvent function
      jest.spyOn(analyticsService, 'trackEvent').mockResolvedValueOnce({ tracked: true });
      
      // Test data
      const action = analyticsService.ACTIONS.CONVERSATION_START;
      const conversationId = 'conv-123';
      const details = { 
        persona: 'ayla',
        room: 'mirrorRoom',
        content: 'This is a private message'
      };
      const user = { id: 'user-123' };
      
      // Call the function
      const result = await analyticsService.trackConversation(action, conversationId, details, user);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalled();
      // The content should not be included
      const callArgs = analyticsService.trackEvent.mock.calls[0];
      expect(callArgs[2].content).toBeNull();
    });
    
    it('should track a conversation event with content when enabled and consented', async () => {
      // Mock config with content tracking enabled
      jest.spyOn(require('../../../config/config'), 'ANALYTICS_TRACK_CONTENT', 'get').mockReturnValue(true);
      
      // Mock trackEvent function
      jest.spyOn(analyticsService, 'trackEvent').mockResolvedValueOnce({ tracked: true });
      
      // Test data
      const action = analyticsService.ACTIONS.CONVERSATION_MESSAGE;
      const conversationId = 'conv-123';
      const details = { 
        persona: 'ayla',
        room: 'mirrorRoom',
        content: 'This is a message that can be tracked'
      };
      const user = { 
        id: 'user-123',
        contentTrackingConsent: true
      };
      
      // Call the function
      const result = await analyticsService.trackConversation(action, conversationId, details, user);
      
      // Assertions
      expect(result.tracked).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalled();
      // The content should be included
      const callArgs = analyticsService.trackEvent.mock.calls[0];
      expect(callArgs[2].content).toBe(details.content);
    });
  });
  
  describe('getAnalyticsData', () => {
    it('should retrieve analytics data successfully', async () => {
      // Mock database query response
      db.query.mockResolvedValueOnce({ 
        rows: [
          { id: 1, category: 'user_interaction', action: 'page_view' },
          { id: 2, category: 'user_interaction', action: 'button_click' }
        ],
        rowCount: 2
      });
      
      // Test data
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      const filters = { category: 'user_interaction' };
      const options = { limit: 10 };
      
      // Call the function
      const result = await analyticsService.getAnalyticsData(startDate, endDate, filters, options);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0].text).toContain('WHERE timestamp >= $1 AND timestamp <= $2');
      expect(db.query.mock.calls[0][0].text).toContain('AND category = $3');
      expect(db.query.mock.calls[0][0].values).toContain('user_interaction');
      expect(db.query.mock.calls[0][0].text).toContain('LIMIT $4');
      expect(db.query.mock.calls[0][0].values).toContain(10);
    });
    
    it('should handle invalid date range', async () => {
      // Test data
      const startDate = 'invalid-date';
      const endDate = '2025-01-31';
      
      // Call the function
      const result = await analyticsService.getAnalyticsData(startDate, endDate);
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid date range');
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should handle database errors', async () => {
      // Mock database query to fail
      db.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Test data
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      // Call the function
      const result = await analyticsService.getAnalyticsData(startDate, endDate);
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getAggregatedMetrics', () => {
    it('should retrieve aggregated metrics successfully', async () => {
      // Mock database query response
      db.query.mockResolvedValueOnce({ 
        rows: [{ value: 42 }]
      });
      
      // Test data
      const metric = 'total_users';
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      const filters = { category: 'user_interaction' };
      
      // Call the function
      const result = await analyticsService.getAggregatedMetrics(metric, startDate, endDate, filters);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.metric).toBe(metric);
      expect(result.value).toBe(42);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0].text).toContain('COUNT(DISTINCT user_id)');
    });
    
    it('should handle invalid metrics', async () => {
      // Test data
      const metric = 'invalid_metric';
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      // Call the function
      const result = await analyticsService.getAggregatedMetrics(metric, startDate, endDate);
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid metric');
      expect(db.query).not.toHaveBeenCalled();
    });
  });
  
  describe('flushInMemoryEvents', () => {
    it('should flush in-memory events to the database', async () => {
      // Add some events to in-memory storage
      // We need to access the private inMemoryEvents array
      const privateInMemoryEvents = analyticsService.__get__('inMemoryEvents');
      privateInMemoryEvents.push(
        { category: 'user_interaction', action: 'page_view', timestamp: new Date().toISOString() },
        { category: 'performance', action: 'api_performance', timestamp: new Date().toISOString() }
      );
      
      // Mock database query response
      db.query.mockResolvedValueOnce({ rowCount: 2 });
      
      // Call the function
      const result = await analyticsService.flushInMemoryEvents();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.flushed).toBe(2);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(privateInMemoryEvents).toHaveLength(0); // Should be cleared
    });
    
    it('should handle empty in-memory events', async () => {
      // Ensure in-memory events array is empty
      const privateInMemoryEvents = analyticsService.__get__('inMemoryEvents');
      privateInMemoryEvents.length = 0;
      
      // Call the function
      const result = await analyticsService.flushInMemoryEvents();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.flushed).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });
    
    it('should handle database errors', async () => {
      // Add some events to in-memory storage
      const privateInMemoryEvents = analyticsService.__get__('inMemoryEvents');
      privateInMemoryEvents.push(
        { category: 'user_interaction', action: 'page_view', timestamp: new Date().toISOString() }
      );
      
      // Mock database query to fail
      db.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Call the function
      const result = await analyticsService.flushInMemoryEvents();
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(privateInMemoryEvents).toHaveLength(1); // Should not be cleared
    });
  });
  
  describe('Privacy and Security', () => {
    it('should anonymize user data', () => {
      // Get the private anonymizeUserData function
      const anonymizeUserData = analyticsService.__get__('anonymizeUserData');
      
      // Test data
      const user = {
        id: 'user-123',
        email: 'user@example.com',
        password: 'secret',
        role: 'user',
        createdAt: '2025-01-01',
        preferences: {
          theme: 'dark',
          language: 'en'
        },
        ip: '192.168.1.1'
      };
      
      // Call the function
      const anonymized = anonymizeUserData(user);
      
      // Assertions
      expect(anonymized.id).toBe(user.id);
      expect(anonymized.role).toBe(user.role);
      expect(anonymized.createdAt).toBe(user.createdAt);
      expect(anonymized.preferences.theme).toBe(user.preferences.theme);
      expect(anonymized.preferences.language).toBe(user.preferences.language);
      expect(anonymized.ipHash).toBeDefined();
      expect(anonymized.email).toBeUndefined();
      expect(anonymized.password).toBeUndefined();
    });
    
    it('should sanitize sensitive data', () => {
      // Get the private sanitizeData function
      const sanitizeData = analyticsService.__get__('sanitizeData');
      
      // Test data
      const data = {
        page: '/profile',
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          creditCard: '4111-1111-1111-1111',
          address: '123 Main St'
        },
        metadata: {
          browser: 'Chrome',
          os: 'Windows'
        }
      };
      
      // Call the function
      const sanitized = sanitizeData(data);
      
      // Assertions
      expect(sanitized.page).toBe(data.page);
      expect(sanitized.metadata.browser).toBe(data.metadata.browser);
      expect(sanitized.metadata.os).toBe(data.metadata.os);
      expect(sanitized.user.name).toBe(data.user.name);
      expect(sanitized.user.email).toBe('[REDACTED]');
      expect(sanitized.user.creditCard).toBe('[REDACTED]');
      expect(sanitized.user.address).toBe('[REDACTED]');
    });
    
    it('should sanitize error details', () => {
      // Get the private sanitizeErrorDetails function
      const sanitizeErrorDetails = analyticsService.__get__('sanitizeErrorDetails');
      
      // Test data
      const details = {
        message: 'Error processing payment',
        stack: 'Error: Error processing payment\n    at /home/user/app/payment.js:123:45',
        request: {
          url: '/api/payments',
          body: {
            amount: 100,
            creditCard: '4111-1111-1111-1111'
          }
        },
        response: {
          status: 500,
          body: {
            error: 'Payment failed',
            details: 'Invalid card'
          }
        }
      };
      
      // Call the function
      const sanitized = sanitizeErrorDetails(details);
      
      // Assertions
      expect(sanitized.message).toBe(details.message);
      expect(sanitized.stack).not.toContain('/home/user/app/payment.js');
      expect(sanitized.stack).toContain('[FILEPATH]');
      expect(sanitized.request.url).toBe(details.request.url);
      expect(sanitized.request.body.amount).toBe(details.request.body.amount);
      expect(sanitized.request.body.creditCard).toBe('[REDACTED]');
      expect(sanitized.response.status).toBe(details.response.status);
      expect(sanitized.response.body.error).toBe(details.response.body.error);
      expect(sanitized.response.body.details).toBe(details.response.body.details);
    });
  });
});
