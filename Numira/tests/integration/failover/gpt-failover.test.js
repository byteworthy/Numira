/**
 * Integration Tests for GPT Failover
 */

const aiService = require('../../../services/aiService');
const openaiService = require('../../../services/openaiService');
const circuitBreaker = require('../../../services/circuitBreaker');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('../../../services/openaiService');
jest.mock('../../../services/circuitBreaker');
jest.mock('../../../utils/logger');
jest.mock('../../../config/config', () => ({
  openai: {
    models: {
      gpt4: 'gpt-4',
      gpt35turbo: 'gpt-3.5-turbo',
      fallback: 'gpt-3.5-turbo'
    },
    apiKey: 'test-api-key'
  },
  ai: {
    maxTokens: 2048,
    temperature: 0.7,
    phiDetection: false
  }
}));

describe('GPT Failover Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset services
    aiService.reset();
    
    // Mock openaiService methods
    openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
      // Simulate different behavior based on model
      if (options && options.model === 'gpt-3.5-turbo') {
        return {
          text: 'GPT-3.5 response',
          usage: { total_tokens: 80 },
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        };
      }
      
      return {
        text: 'GPT-4 response',
        usage: { total_tokens: 120 },
        provider: 'openai',
        model: 'gpt-4'
      };
    });
    
    // Mock circuitBreaker methods
    circuitBreaker.execute.mockImplementation(async (service, fn) => {
      return fn();
    });
    
    circuitBreaker.isOpen.mockResolvedValue(false);
  });

  describe('Model Failover', () => {
    it('should use primary model when circuit is closed', async () => {
      // Initialize services
      await aiService.initialize();
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4' };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'GPT-4 response',
        usage: { total_tokens: 120 },
        provider: 'openai',
        model: 'gpt-4'
      });
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('model:gpt-4');
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        model: 'gpt-4'
      });
    });

    it('should use fallback model when primary model circuit is open', async () => {
      // Initialize services
      await aiService.initialize();
      
      // Mock circuit breaker to show primary model circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4' };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'GPT-3.5 response',
        usage: { total_tokens: 80 },
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('model:gpt-4');
      expect(logger.warn).toHaveBeenCalledWith('Primary model circuit open, using fallback', {
        primaryModel: 'gpt-4',
        fallbackModel: 'gpt-3.5-turbo'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        model: 'gpt-3.5-turbo'
      });
    });

    it('should open circuit after multiple failures', async () => {
      // Initialize services
      await aiService.initialize();
      
      // Mock circuit breaker to record failures and eventually open circuit
      let failureCount = 0;
      circuitBreaker.execute.mockImplementation(async (service, fn, fallback) => {
        if (service === 'model:gpt-4' && failureCount < 5) {
          failureCount++;
          throw new Error('Model error');
        }
        return fn();
      });
      
      const options = { model: 'gpt-4' };
      
      // First 5 calls should fail and increment failure count
      for (let i = 0; i < 5; i++) {
        try {
          await aiService.generateResponse('Test prompt', options);
        } catch (error) {
          expect(error.message).toBe('Model error');
        }
      }
      
      // Mock circuit breaker to show primary model circuit is now open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      // Next call should use fallback model
      const result = await aiService.generateResponse('Test prompt', options);
      
      expect(result).toEqual({
        text: 'GPT-3.5 response',
        usage: { total_tokens: 80 },
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should throw error when both primary and fallback models fail', async () => {
      // Initialize services
      await aiService.initialize();
      
      // Mock circuit breaker to show primary model circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      // Mock openaiService to fail for all models
      openaiService.generateCompletion.mockRejectedValue(new Error('All models failed'));
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4' };
      
      await expect(aiService.generateResponse(prompt, options)).rejects.toThrow('All models failed');
      
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('model:gpt-4');
      expect(logger.warn).toHaveBeenCalledWith('Primary model circuit open, using fallback', {
        primaryModel: 'gpt-4',
        fallbackModel: 'gpt-3.5-turbo'
      });
      expect(logger.error).toHaveBeenCalledWith('Error generating AI response', {
        error: expect.any(Error)
      });
    });

    it('should recover when circuit closes after timeout', async () => {
      // Initialize services
      await aiService.initialize();
      
      const options = { model: 'gpt-4' };
      
      // First, mock circuit breaker to show primary model circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      // First call should use fallback model
      let result = await aiService.generateResponse('Test prompt', options);
      
      expect(result).toEqual({
        text: 'GPT-3.5 response',
        usage: { total_tokens: 80 },
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
      
      // Then, mock circuit breaker to show primary model circuit is closed again
      circuitBreaker.isOpen.mockResolvedValue(false);
      
      // Next call should use primary model again
      result = await aiService.generateResponse('Test prompt', options);
      
      expect(result).toEqual({
        text: 'GPT-4 response',
        usage: { total_tokens: 120 },
        provider: 'openai',
        model: 'gpt-4'
      });
    });
  });

  describe('Model Selection', () => {
    it('should use default model when none specified', async () => {
      // Initialize services
      await aiService.initialize();
      
      const prompt = 'Test prompt';
      
      const result = await aiService.generateResponse(prompt);
      
      // Default model should be gpt-4 based on our mock
      expect(result).toEqual({
        text: 'GPT-4 response',
        usage: { total_tokens: 120 },
        provider: 'openai',
        model: 'gpt-4'
      });
    });

    it('should use specified model when provided', async () => {
      // Initialize services
      await aiService.initialize();
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-3.5-turbo' };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'GPT-3.5 response',
        usage: { total_tokens: 80 },
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        model: 'gpt-3.5-turbo'
      });
    });

    it('should use custom fallback model when specified', async () => {
      // Initialize services
      await aiService.initialize();
      
      // Temporarily modify config
      const originalFallbackModel = config.openai.models.fallback;
      config.openai.models.fallback = 'custom-fallback-model';
      
      // Mock circuit breaker to show primary model circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      // Mock custom fallback model response
      openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
        if (options && options.model === 'custom-fallback-model') {
          return {
            text: 'Custom fallback response',
            usage: { total_tokens: 90 },
            provider: 'openai',
            model: 'custom-fallback-model'
          };
        }
        return {
          text: 'GPT-4 response',
          usage: { total_tokens: 120 },
          provider: 'openai',
          model: 'gpt-4'
        };
      });
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4' };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'Custom fallback response',
        usage: { total_tokens: 90 },
        provider: 'openai',
        model: 'custom-fallback-model'
      });
      expect(logger.warn).toHaveBeenCalledWith('Primary model circuit open, using fallback', {
        primaryModel: 'gpt-4',
        fallbackModel: 'custom-fallback-model'
      });
      
      // Restore config
      config.openai.models.fallback = originalFallbackModel;
    });
  });

  describe('Integration with Provider Failover', () => {
    it('should handle both model and provider failover', async () => {
      // This test simulates a scenario where:
      // 1. The primary model (gpt-4) circuit is open
      // 2. The fallback model with the primary provider also fails
      // 3. The system falls back to a different provider
      
      // Initialize services
      await aiService.initialize();
      
      // Mock circuit breaker to show primary model circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'model:gpt-4';
      });
      
      // Mock openaiService to fail for the primary provider but succeed for the fallback
      let callCount = 0;
      openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
        callCount++;
        
        if (callCount === 1) {
          // First call (fallback model, primary provider) fails
          throw new Error('Provider error');
        }
        
        // Second call (fallback model, fallback provider) succeeds
        return {
          text: 'Fallback provider response',
          usage: { total_tokens: 70 },
          provider: 'azure',
          model: 'gpt-3.5-turbo'
        };
      });
      
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4' };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'Fallback provider response',
        usage: { total_tokens: 70 },
        provider: 'azure',
        model: 'gpt-3.5-turbo'
      });
      
      // Should have tried the fallback model with primary provider first
      expect(logger.warn).toHaveBeenCalledWith('Primary model circuit open, using fallback', {
        primaryModel: 'gpt-4',
        fallbackModel: 'gpt-3.5-turbo'
      });
      
      // Then should have tried the fallback provider
      expect(logger.warn).toHaveBeenCalledWith('Primary provider failed, trying fallback provider', {
        error: expect.any(Error),
        fallbackProvider: 'azure'
      });
    });
  });
});
