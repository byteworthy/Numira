/**
 * Integration Tests for LLM Provider Failover
 */

const aiService = require('../../../services/aiService');
const llmProviderService = require('../../../services/llmProviderService');
const circuitBreaker = require('../../../services/circuitBreaker');
const openaiService = require('../../../services/openaiService');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('../../../services/openaiService');
jest.mock('../../../services/circuitBreaker');
jest.mock('../../../utils/logger');
jest.mock('../../../config/config', () => ({
  llm: {
    providers: ['openai', 'anthropic', 'azure'],
    defaultProvider: 'openai',
    fallbackProvider: 'azure',
    cacheResponses: false,
    cacheTTL: 3600
  },
  ai: {
    maxTokens: 2048,
    temperature: 0.7,
    phiDetection: false
  }
}));

describe('LLM Provider Failover Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset services
    aiService.reset();
    llmProviderService.reset();
    
    // Mock openaiService methods
    openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
      // Simulate different behavior based on provider
      if (options && options.provider === 'azure') {
        return {
          text: 'Azure response',
          usage: { total_tokens: 120 },
          provider: 'azure'
        };
      }
      
      return {
        text: 'OpenAI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      };
    });
    
    // Mock circuitBreaker methods
    circuitBreaker.execute.mockImplementation(async (service, fn) => {
      return fn();
    });
    
    circuitBreaker.isOpen.mockResolvedValue(false);
  });

  describe('Provider Failover', () => {
    it('should use primary provider when circuit is closed', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      const prompt = 'Test prompt';
      const result = await aiService.generateResponse(prompt);
      
      expect(result).toEqual({
        text: 'OpenAI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('llm:openai');
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        provider: 'openai'
      });
    });

    it('should use fallback provider when primary provider circuit is open', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Mock circuit breaker to show primary provider circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      const prompt = 'Test prompt';
      const result = await aiService.generateResponse(prompt);
      
      expect(result).toEqual({
        text: 'Azure response',
        usage: { total_tokens: 120 },
        provider: 'azure'
      });
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('llm:openai');
      expect(logger.warn).toHaveBeenCalledWith('Primary provider circuit open, using fallback', {
        primaryProvider: 'openai',
        fallbackProvider: 'azure'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        provider: 'azure'
      });
    });

    it('should open circuit after multiple failures', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Mock circuit breaker to record failures and eventually open circuit
      let failureCount = 0;
      circuitBreaker.execute.mockImplementation(async (service, fn, fallback) => {
        if (service === 'llm:openai' && failureCount < 5) {
          failureCount++;
          throw new Error('Service error');
        }
        return fn();
      });
      
      // First 5 calls should fail and increment failure count
      for (let i = 0; i < 5; i++) {
        try {
          await aiService.generateResponse('Test prompt');
        } catch (error) {
          expect(error.message).toBe('Service error');
        }
      }
      
      // Mock circuit breaker to show primary provider circuit is now open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      // Next call should use fallback provider
      const result = await aiService.generateResponse('Test prompt');
      
      expect(result).toEqual({
        text: 'Azure response',
        usage: { total_tokens: 120 },
        provider: 'azure'
      });
    });

    it('should use specified provider regardless of circuit state for direct provider calls', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Mock circuit breaker to show all provider circuits are open
      circuitBreaker.isOpen.mockResolvedValue(true);
      
      const prompt = 'Test prompt';
      const result = await llmProviderService.generateCompletionWithProvider('azure', prompt, {
        temperature: 0.5
      });
      
      expect(result).toEqual({
        text: 'Azure response',
        usage: { total_tokens: 120 },
        provider: 'azure'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.5,
        provider: 'azure'
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should throw error when both primary and fallback providers fail', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Mock circuit breaker to show primary provider circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      // Mock openaiService to fail for all providers
      openaiService.generateCompletion.mockRejectedValue(new Error('All providers failed'));
      
      const prompt = 'Test prompt';
      
      await expect(aiService.generateResponse(prompt)).rejects.toThrow('All providers failed');
      
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('llm:openai');
      expect(logger.warn).toHaveBeenCalledWith('Primary provider circuit open, using fallback', {
        primaryProvider: 'openai',
        fallbackProvider: 'azure'
      });
      expect(logger.error).toHaveBeenCalledWith('Error generating AI response', {
        error: expect.any(Error)
      });
    });

    it('should recover when circuit closes after timeout', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // First, mock circuit breaker to show primary provider circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      // First call should use fallback provider
      let result = await aiService.generateResponse('Test prompt');
      
      expect(result).toEqual({
        text: 'Azure response',
        usage: { total_tokens: 120 },
        provider: 'azure'
      });
      
      // Then, mock circuit breaker to show primary provider circuit is closed again
      circuitBreaker.isOpen.mockResolvedValue(false);
      
      // Next call should use primary provider again
      result = await aiService.generateResponse('Test prompt');
      
      expect(result).toEqual({
        text: 'OpenAI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
    });
  });

  describe('Provider Selection', () => {
    it('should allow changing the primary provider', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Change primary provider to anthropic
      llmProviderService.setProvider('anthropic');
      
      // Mock anthropic provider response
      openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
        if (options && options.provider === 'anthropic') {
          return {
            text: 'Anthropic response',
            usage: { total_tokens: 150 },
            provider: 'anthropic'
          };
        }
        return {
          text: 'OpenAI response',
          usage: { total_tokens: 100 },
          provider: 'openai'
        };
      });
      
      const prompt = 'Test prompt';
      const result = await aiService.generateResponse(prompt);
      
      expect(result).toEqual({
        text: 'Anthropic response',
        usage: { total_tokens: 150 },
        provider: 'anthropic'
      });
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('llm:anthropic');
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
        provider: 'anthropic'
      });
    });

    it('should use custom fallback provider when specified', async () => {
      // Initialize services
      await aiService.initialize();
      await llmProviderService.initialize('openai');
      
      // Temporarily modify config
      const originalFallbackProvider = config.llm.fallbackProvider;
      config.llm.fallbackProvider = 'anthropic';
      
      // Mock circuit breaker to show primary provider circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      // Mock anthropic provider response
      openaiService.generateCompletion.mockImplementation(async (prompt, options) => {
        if (options && options.provider === 'anthropic') {
          return {
            text: 'Anthropic response',
            usage: { total_tokens: 150 },
            provider: 'anthropic'
          };
        }
        return {
          text: 'OpenAI response',
          usage: { total_tokens: 100 },
          provider: 'openai'
        };
      });
      
      const prompt = 'Test prompt';
      const result = await aiService.generateResponse(prompt);
      
      expect(result).toEqual({
        text: 'Anthropic response',
        usage: { total_tokens: 150 },
        provider: 'anthropic'
      });
      expect(logger.warn).toHaveBeenCalledWith('Primary provider circuit open, using fallback', {
        primaryProvider: 'openai',
        fallbackProvider: 'anthropic'
      });
      
      // Restore config
      config.llm.fallbackProvider = originalFallbackProvider;
    });
  });
});
