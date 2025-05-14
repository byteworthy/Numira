/**
 * Unit Tests for LLM Provider Service
 */

const llmProviderService = require('../../../services/llmProviderService');
const openaiService = require('../../../services/openaiService');
const circuitBreaker = require('../../../services/circuitBreaker');
const cacheService = require('../../../services/cacheService');
const config = require('../../../config/config');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../services/openaiService');
jest.mock('../../../services/circuitBreaker');
jest.mock('../../../services/cacheService');
jest.mock('../../../config/config', () => ({
  llm: {
    providers: ['openai', 'anthropic', 'azure'],
    defaultProvider: 'openai',
    fallbackProvider: 'azure',
    cacheResponses: true,
    cacheTTL: 3600
  }
}));
jest.mock('../../../utils/logger');

describe('LLM Provider Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    llmProviderService.reset();
    
    // Mock openaiService methods
    openaiService.generateCompletion.mockResolvedValue({
      text: 'OpenAI response',
      usage: { total_tokens: 100 }
    });
    
    // Mock circuitBreaker methods
    circuitBreaker.execute.mockImplementation((service, fn) => fn());
    circuitBreaker.isOpen.mockResolvedValue(false);
    
    // Mock cacheService methods
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue('OK');
  });

  describe('initialize', () => {
    it('should initialize with default provider', async () => {
      await llmProviderService.initialize();
      
      expect(llmProviderService.getProvider()).toBe('openai');
      expect(logger.info).toHaveBeenCalledWith('LLM provider service initialized', {
        provider: 'openai',
        availableProviders: ['openai', 'anthropic', 'azure']
      });
    });

    it('should initialize with specified provider', async () => {
      await llmProviderService.initialize('azure');
      
      expect(llmProviderService.getProvider()).toBe('azure');
      expect(logger.info).toHaveBeenCalledWith('LLM provider service initialized', {
        provider: 'azure',
        availableProviders: ['openai', 'anthropic', 'azure']
      });
    });

    it('should fall back to default provider if specified provider is invalid', async () => {
      await llmProviderService.initialize('invalid-provider');
      
      expect(llmProviderService.getProvider()).toBe('openai');
      expect(logger.warn).toHaveBeenCalledWith('Invalid provider specified, using default', {
        requestedProvider: 'invalid-provider',
        defaultProvider: 'openai'
      });
    });

    it('should not re-initialize if already initialized', async () => {
      await llmProviderService.initialize('azure');
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Initialize again
      await llmProviderService.initialize('anthropic');
      
      // Should not change provider or log
      expect(llmProviderService.getProvider()).toBe('azure');
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('getProvider', () => {
    it('should return the current provider', async () => {
      await llmProviderService.initialize('azure');
      
      expect(llmProviderService.getProvider()).toBe('azure');
    });

    it('should initialize with default provider if not initialized', () => {
      expect(llmProviderService.getProvider()).toBe('openai');
    });
  });

  describe('setProvider', () => {
    it('should set a valid provider', async () => {
      await llmProviderService.initialize();
      
      const result = llmProviderService.setProvider('anthropic');
      
      expect(result).toBe(true);
      expect(llmProviderService.getProvider()).toBe('anthropic');
      expect(logger.info).toHaveBeenCalledWith('LLM provider changed', {
        provider: 'anthropic'
      });
    });

    it('should reject an invalid provider', async () => {
      await llmProviderService.initialize();
      
      const result = llmProviderService.setProvider('invalid-provider');
      
      expect(result).toBe(false);
      expect(llmProviderService.getProvider()).toBe('openai'); // Unchanged
      expect(logger.warn).toHaveBeenCalledWith('Invalid provider specified', {
        requestedProvider: 'invalid-provider'
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('should return the list of available providers', () => {
      expect(llmProviderService.getAvailableProviders()).toEqual(['openai', 'anthropic', 'azure']);
    });
  });

  describe('generateCompletion', () => {
    it('should generate completion using the current provider', async () => {
      await llmProviderService.initialize('openai');
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      const result = await llmProviderService.generateCompletion(prompt, options);
      
      expect(result).toEqual({
        text: 'OpenAI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, options);
      expect(circuitBreaker.execute).toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      // Set up cache hit
      const cachedResponse = {
        text: 'Cached response',
        usage: { total_tokens: 50 },
        provider: 'openai'
      };
      cacheService.get.mockResolvedValue(cachedResponse);
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      const result = await llmProviderService.generateCompletion(prompt, options);
      
      expect(result).toEqual(cachedResponse);
      expect(cacheService.get).toHaveBeenCalled();
      expect(openaiService.generateCompletion).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cache hit for LLM request', expect.any(Object));
    });

    it('should cache responses when caching is enabled', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await llmProviderService.generateCompletion(prompt, options);
      
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should not cache responses when caching is disabled', async () => {
      // Temporarily modify config
      const originalCacheResponses = config.llm.cacheResponses;
      config.llm.cacheResponses = false;
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await llmProviderService.generateCompletion(prompt, options);
      
      expect(cacheService.set).not.toHaveBeenCalled();
      
      // Restore config
      config.llm.cacheResponses = originalCacheResponses;
    });

    it('should not cache responses when temperature is high', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.9 }; // High temperature = more randomness
      
      await llmProviderService.generateCompletion(prompt, options);
      
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should use circuit breaker for provider calls', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await llmProviderService.generateCompletion(prompt, options);
      
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        'llm:openai',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should use fallback provider when primary provider circuit is open', async () => {
      // Mock circuit breaker to show primary provider circuit is open
      circuitBreaker.isOpen.mockImplementation(async (service) => {
        return service === 'llm:openai';
      });
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await llmProviderService.generateCompletion(prompt, options);
      
      // Should check if primary provider circuit is open
      expect(circuitBreaker.isOpen).toHaveBeenCalledWith('llm:openai');
      
      // Should use fallback provider
      expect(logger.warn).toHaveBeenCalledWith('Primary provider circuit open, using fallback', {
        primaryProvider: 'openai',
        fallbackProvider: 'azure'
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock circuit breaker to throw error
      circuitBreaker.execute.mockRejectedValue(new Error('Service error'));
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await expect(llmProviderService.generateCompletion(prompt, options)).rejects.toThrow('Service error');
      
      expect(logger.error).toHaveBeenCalledWith('Error generating completion', {
        error: expect.any(Error),
        provider: 'openai'
      });
    });
  });

  describe('generateCompletionWithProvider', () => {
    it('should generate completion with specified provider', async () => {
      await llmProviderService.initialize('openai');
      
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      const result = await llmProviderService.generateCompletionWithProvider('azure', prompt, options);
      
      expect(result).toEqual({
        text: 'OpenAI response',
        usage: { total_tokens: 100 },
        provider: 'azure'
      });
      expect(openaiService.generateCompletion).toHaveBeenCalledWith(prompt, options);
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        'llm:azure',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should reject invalid provider', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.7 };
      
      await expect(llmProviderService.generateCompletionWithProvider('invalid-provider', prompt, options))
        .rejects.toThrow('Invalid provider: invalid-provider');
    });
  });

  describe('reset', () => {
    it('should reset the service state', async () => {
      // First set a non-default provider
      await llmProviderService.initialize('azure');
      
      // Reset
      llmProviderService.reset();
      
      // Should be back to default
      expect(llmProviderService.getProvider()).toBe('openai');
    });
  });
});
