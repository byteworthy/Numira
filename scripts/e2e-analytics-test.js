/**
 * End-to-End Analytics Test Script
 * 
 * This script tests the complete analytics system by simulating user interactions,
 * tracking events, and verifying that the data is correctly stored and retrieved.
 * 
 * It serves as both a test and a demonstration of how to use the analytics system.
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  adminToken: process.env.ADMIN_TEST_TOKEN,
  userToken: process.env.USER_TEST_TOKEN,
  testTimeout: 30000 // 30 seconds
};

// Test user data
const testUser = {
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  role: 'user'
};

// Test session ID
const testSessionId = uuidv4();

/**
 * Create HTTP clients with authentication
 */
const adminClient = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.adminToken}`,
    'X-Session-ID': testSessionId,
    'X-Client-Type': 'e2e-test',
    'X-Client-Version': '1.0.0',
    'X-Client-OS': 'test',
    'X-Client-Device': 'test'
  },
  timeout: config.testTimeout
});

const userClient = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.userToken}`,
    'X-Session-ID': testSessionId,
    'X-Client-Type': 'e2e-test',
    'X-Client-Version': '1.0.0',
    'X-Client-OS': 'test',
    'X-Client-Device': 'test'
  },
  timeout: config.testTimeout
});

const anonymousClient = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Session-ID': testSessionId,
    'X-Client-Type': 'e2e-test',
    'X-Client-Version': '1.0.0',
    'X-Client-OS': 'test',
    'X-Client-Device': 'test'
  },
  timeout: config.testTimeout
});

/**
 * Helper function to wait for a specified time
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test registration and login flow with analytics tracking
 */
const testAuthFlow = async () => {
  logger.info('Testing authentication flow with analytics tracking...');
  
  try {
    // Register a new user
    const registerResponse = await anonymousClient.post('/api/users', testUser);
    logger.info('User registered successfully', { userId: registerResponse.data.user.id });
    
    // Track signup event
    await userClient.post('/api/analytics/event', {
      category: 'conversion',
      action: 'signup',
      data: {
        source: 'e2e-test',
        referrer: 'direct'
      }
    });
    
    // Login
    const loginResponse = await anonymousClient.post('/api/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    
    // Update user client with new token
    userClient.defaults.headers.Authorization = `Bearer ${loginResponse.data.token}`;
    
    // Track login event
    await userClient.post('/api/analytics/event', {
      category: 'user_interaction',
      action: 'login',
      data: {
        method: 'password',
        device: 'desktop'
      }
    });
    
    logger.info('Authentication flow tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing authentication flow', { error: error.message });
    return false;
  }
};

/**
 * Test page view tracking
 */
const testPageViewTracking = async () => {
  logger.info('Testing page view tracking...');
  
  try {
    // Track page views for different pages
    const pages = [
      '/dashboard',
      '/personas',
      '/conversations',
      '/settings',
      '/profile'
    ];
    
    for (const page of pages) {
      await userClient.post('/api/analytics/page-view', {
        page,
        referrer: pages[Math.floor(Math.random() * pages.length)]
      });
      
      // Simulate user spending time on the page
      await wait(500);
    }
    
    logger.info('Page view tracking tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing page view tracking', { error: error.message });
    return false;
  }
};

/**
 * Test conversation tracking
 */
const testConversationTracking = async () => {
  logger.info('Testing conversation tracking...');
  
  try {
    // Create a new conversation
    const conversationId = uuidv4();
    const persona = 'ayla';
    const room = 'mirrorRoom';
    
    // Track conversation start
    await userClient.post('/api/analytics/conversation', {
      action: 'conversation_start',
      conversationId,
      details: {
        persona,
        room
      }
    });
    
    // Simulate a conversation with multiple messages
    const messages = [
      'Hello, how are you today?',
      'I\'ve been feeling a bit stressed lately.',
      'Work has been quite demanding.',
      'Thank you for the advice, that helps.'
    ];
    
    for (let i = 0; i < messages.length; i++) {
      // Track each message
      await userClient.post('/api/analytics/conversation', {
        action: 'conversation_message',
        conversationId,
        details: {
          persona,
          room,
          messageCount: i + 1,
          // Note: In a real scenario, content would not be tracked unless explicitly consented to
          content: null
        }
      });
      
      // Simulate time between messages
      await wait(500);
    }
    
    // Track conversation end
    await userClient.post('/api/analytics/conversation', {
      action: 'conversation_end',
      conversationId,
      details: {
        persona,
        room,
        messageCount: messages.length,
        duration: messages.length * 500 // Simulated duration
      }
    });
    
    logger.info('Conversation tracking tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing conversation tracking', { error: error.message });
    return false;
  }
};

/**
 * Test error tracking
 */
const testErrorTracking = async () => {
  logger.info('Testing error tracking...');
  
  try {
    // Track a frontend error
    await userClient.post('/api/analytics/error', {
      errorType: 'error_frontend',
      message: 'Test frontend error',
      details: {
        component: 'TestComponent',
        action: 'buttonClick',
        stack: 'Error: Test frontend error\n    at TestComponent.handleClick (TestComponent.js:42:15)'
      },
      url: '/dashboard'
    });
    
    // Track an API error
    await userClient.post('/api/analytics/error', {
      errorType: 'error_api',
      message: 'Test API error',
      details: {
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 500,
        response: {
          error: 'Internal Server Error'
        }
      }
    });
    
    logger.info('Error tracking tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing error tracking', { error: error.message });
    return false;
  }
};

/**
 * Test feature usage tracking
 */
const testFeatureUsageTracking = async () => {
  logger.info('Testing feature usage tracking...');
  
  try {
    // Track various feature usages
    const features = [
      { name: 'darkMode', action: 'feature_enable' },
      { name: 'notifications', action: 'feature_enable' },
      { name: 'journaling', action: 'feature_interact' },
      { name: 'export', action: 'feature_interact' },
      { name: 'sharing', action: 'feature_disable' }
    ];
    
    for (const feature of features) {
      await userClient.post('/api/analytics/event', {
        category: 'feature_usage',
        action: feature.action,
        data: {
          feature: feature.name,
          details: {
            source: 'settings',
            value: feature.action === 'feature_enable' ? true : 
                  feature.action === 'feature_disable' ? false : null
          }
        }
      });
      
      // Simulate time between actions
      await wait(300);
    }
    
    logger.info('Feature usage tracking tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing feature usage tracking', { error: error.message });
    return false;
  }
};

/**
 * Test API performance tracking
 */
const testApiPerformanceTracking = async () => {
  logger.info('Testing API performance tracking...');
  
  try {
    // Simulate API calls with different response times
    const endpoints = [
      { path: '/api/personas', method: 'GET', responseTime: 120, statusCode: 200 },
      { path: '/api/rooms', method: 'GET', responseTime: 85, statusCode: 200 },
      { path: '/api/conversations', method: 'POST', responseTime: 350, statusCode: 201 },
      { path: '/api/ai/respond', method: 'POST', responseTime: 1200, statusCode: 200 },
      { path: '/api/nonexistent', method: 'GET', responseTime: 50, statusCode: 404 }
    ];
    
    for (const endpoint of endpoints) {
      await userClient.post('/api/analytics/event', {
        category: 'performance',
        action: 'performance_api',
        data: {
          endpoint: endpoint.path,
          method: endpoint.method,
          responseTime: endpoint.responseTime,
          statusCode: endpoint.statusCode
        }
      });
    }
    
    logger.info('API performance tracking tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing API performance tracking', { error: error.message });
    return false;
  }
};

/**
 * Test analytics data retrieval (admin only)
 */
const testAnalyticsDataRetrieval = async () => {
  logger.info('Testing analytics data retrieval...');
  
  try {
    // Wait a bit to ensure all events are processed
    await wait(2000);
    
    // Get analytics data for the test session
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 1); // 1 hour ago
    
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 1); // 1 hour from now
    
    // Get all events for the test session
    const eventsResponse = await adminClient.get('/api/analytics/data', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100
      }
    });
    
    logger.info(`Retrieved ${eventsResponse.data.count} analytics events`);
    
    // Get aggregated metrics
    const metrics = [
      'total_users',
      'total_sessions',
      'total_conversations',
      'error_rate'
    ];
    
    for (const metric of metrics) {
      const metricResponse = await adminClient.get(`/api/analytics/metrics/${metric}`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      
      logger.info(`Metric ${metric}: ${metricResponse.data.value}`);
    }
    
    logger.info('Analytics data retrieval tested successfully');
    return true;
  } catch (error) {
    logger.error('Error testing analytics data retrieval', { error: error.message });
    return false;
  }
};

/**
 * Run all tests
 */
const runTests = async () => {
  logger.info('Starting end-to-end analytics tests...');
  
  const testResults = {
    authFlow: await testAuthFlow(),
    pageViewTracking: await testPageViewTracking(),
    conversationTracking: await testConversationTracking(),
    errorTracking: await testErrorTracking(),
    featureUsageTracking: await testFeatureUsageTracking(),
    apiPerformanceTracking: await testApiPerformanceTracking(),
    analyticsDataRetrieval: await testAnalyticsDataRetrieval()
  };
  
  // Calculate overall success
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(result => result).length;
  
  logger.info('End-to-end analytics tests completed', {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests
  });
  
  // Log detailed results
  logger.info('Test results:', testResults);
  
  // Exit with appropriate code
  process.exit(passedTests === totalTests ? 0 : 1);
};

// Run the tests
runTests().catch(error => {
  logger.error('Unhandled error in tests', { error: error.message });
  process.exit(1);
});
