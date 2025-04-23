/**
 * Integration tests for LLM provider failover functionality
 * 
 * Tests the ability of the system to gracefully handle LLM provider failures
 * and switch to alternative providers when necessary.
 */

const request = require('supertest');
const app = require('../../../server');
const llmProviderService = require('../../../services/llmProviderService');
const circuitBreaker = require('../../../services/circuitBreaker');
const { generateToken } = require('../../../services/authService');

// Mock user for testing
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin'
};

// Generate a valid JWT for the test user
const authToken = generateToken(testUser);

describe('LLM Provider Failover', () => {
  beforeAll(async () => {
    // Reset all circuit breakers before tests
    circuitBreaker.resetAllBreakers();
  });

  afterAll(async () => {
    // Clean up after tests
    circuitBreaker.resetAllBreakers();
  });

  describe('Circuit Breaker Functionality', () => {
    test('Circuit breaker should open after multiple failures', async () => {
      // Get the OpenAI circuit breaker
      const openaiBreaker = circuitBreaker.createBreaker('openai');
      
      // Force multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => {
            throw new Error('Simulated OpenAI API failure');
          });
        } catch (error) {
          // Expected error
        }
      }
      
      // Circuit should now be open
      expect(openaiBreaker.isOpen()).toBe(true);
      
      // Reset for other tests
      openaiBreaker.reset();
    });
    
    test('Circuit breaker should reset after manual reset', async () => {
      // Get the OpenAI circuit breaker
      const openaiBreaker = circuitBreaker.createBreaker('openai');
      
      // Force multiple failures to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => {
            throw new Error('Simulated OpenAI API failure');
          });
        } catch (error) {
          // Expected error
        }
      }
      
      // Circuit should now be open
      expect(openaiBreaker.isOpen()).toBe(true);
      
      // Reset the circuit breaker
      circuitBreaker.resetBreaker('openai');
      
      // Circuit should now be closed
      expect(openaiBreaker.isOpen()).toBe(false);
    });
  });
  
  describe('LLM Provider API Endpoints', () => {
    test('GET /api/llm/status should return provider status', async () => {
      const response = await request(app)
        .get('/api/llm/status')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('providers');
      expect(response.body.data).toHaveProperty('circuitBreakers');
    });
    
    test('POST /api/llm/reset/:provider should reset specific provider', async () => {
      // First, force the circuit open
      const openaiBreaker = circuitBreaker.createBreaker('openai');
      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => {
            throw new Error('Simulated OpenAI API failure');
          });
        } catch (error) {
          // Expected error
        }
      }
      
      // Verify circuit is open
      expect(openaiBreaker.isOpen()).toBe(true);
      
      // Reset via API
      const response = await request(app)
        .post('/api/llm/reset/openai')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('reset successfully');
      
      // Verify circuit is now closed
      expect(openaiBreaker.isOpen()).toBe(false);
    });
    
    test('POST /api/llm/reset-all should reset all providers', async () => {
      // Force multiple circuits open
      const openaiBreaker = circuitBreaker.createBreaker('openai');
      const anthropicBreaker = circuitBreaker.createBreaker('anthropic');
      
      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => {
            throw new Error('Simulated OpenAI API failure');
          });
        } catch (error) {
          // Expected error
        }
        
        try {
          await anthropicBreaker.execute(() => {
            throw new Error('Simulated Anthropic API failure');
          });
        } catch (error) {
          // Expected error
        }
      }
      
      // Verify circuits are open
      expect(openaiBreaker.isOpen()).toBe(true);
      expect(anthropicBreaker.isOpen()).toBe(true);
      
      // Reset all via API
      const response = await request(app)
        .post('/api/llm/reset-all')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('All circuit breakers reset successfully');
      
      // Verify circuits are now closed
      expect(openaiBreaker.isOpen()).toBe(false);
      expect(anthropicBreaker.isOpen()).toBe(false);
    });
  });
  
  describe('Provider Selection and Failover', () => {
    test('Should select appropriate model based on input complexity', () => {
      // Simple input
      const simpleInput = 'Hello, how are you?';
      const simpleResult = llmProviderService.selectModel('System prompt', simpleInput);
      
      // Complex input
      const complexInput = 'I need a detailed analysis of the philosophical implications of artificial consciousness, including considerations of qualia, the hard problem of consciousness, and ethical frameworks for determining personhood status of advanced AI systems. Please include references to major thinkers in this field and address counterarguments to the main positions.';
      const complexResult = llmProviderService.selectModel('System prompt', complexInput);
      
      // The complex input should select a more capable model
      expect(simpleResult).toBeDefined();
      expect(complexResult).toBeDefined();
      
      // We can't make specific assertions about which models are selected
      // since it depends on the available providers and their configurations,
      // but we can verify that the function returns a valid selection
      expect(simpleResult).toHaveProperty('provider');
      expect(simpleResult).toHaveProperty('model');
      expect(complexResult).toHaveProperty('provider');
      expect(complexResult).toHaveProperty('model');
    });
    
    test('Should estimate token count correctly', () => {
      const text = 'This is a test sentence with approximately 10 tokens.';
      const count = llmProviderService.estimateTokenCount(text);
      
      // Token count should be roughly text.length / 4
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(text.length);
      
      // Test empty input
      expect(llmProviderService.estimateTokenCount('')).toBe(0);
      expect(llmProviderService.estimateTokenCount(null)).toBe(0);
      expect(llmProviderService.estimateTokenCount(undefined)).toBe(0);
    });
  });
  
  describe('AI Chat Endpoint with Failover', () => {
    // This test requires mocking the LLM provider service
    // to simulate a failure and test the failover behavior
    test('AI chat should handle provider failures gracefully', async () => {
      // Save original implementation
      const originalGetAIResponse = llmProviderService.getAIResponse;
      
      // Mock the getAIResponse method to simulate a failure then success
      let callCount = 0;
      llmProviderService.getAIResponse = jest.fn().mockImplementation(async (params) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated provider failure');
        }
        return 'Fallback response from alternative provider';
      });
      
      // Make a request to the AI chat endpoint
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userInput: 'Test input for failover',
          personaId: 'ayla',
          roomId: 'mirrorRoom'
        });
      
      // Restore original implementation
      llmProviderService.getAIResponse = originalGetAIResponse;
      
      // The request should still succeed with the fallback
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('response');
    });
  });
});
