/**
 * Unit Tests for AI Service
 */

const aiService = require('../../../services/aiService');
const llmProviderService = require('../../../services/llmProviderService');
const circuitBreaker = require('../../../services/circuitBreaker');
const cacheService = require('../../../services/cacheService');
const logger = require('../../../utils/logger');
const phiDetector = require('../../../utils/phiDetector');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('../../../services/llmProviderService');
jest.mock('../../../services/circuitBreaker');
jest.mock('../../../services/cacheService');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/phiDetector');
jest.mock('../../../config/config', () => ({
  ai: {
    maxTokens: 2048,
    temperature: 0.7,
    cacheResponses: true,
    cacheTTL: 3600,
    phiDetection: true
  }
}));

describe('AI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    aiService.reset();
    
    // Mock llmProviderService methods
    llmProviderService.generateCompletion.mockResolvedValue({
      text: 'AI response',
      usage: { total_tokens: 100 },
      provider: 'openai'
    });
    
    // Mock circuitBreaker methods
    circuitBreaker.execute.mockImplementation((service, fn) => fn());
    
    // Mock cacheService methods
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue('OK');
    
    // Mock phiDetector methods
    phiDetector.containsPHI.mockReturnValue(false);
    phiDetector.sanitizeInput.mockImplementation(input => input);
    phiDetector.getPHIDetectionMessage.mockReturnValue('PHI detected message');
  });

  describe('initialize', () => {
    it('should initialize the service', async () => {
      await aiService.initialize();
      
      expect(llmProviderService.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('AI service initialized');
    });

    it('should not re-initialize if already initialized', async () => {
      await aiService.initialize();
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Initialize again
      await aiService.initialize();
      
      // Should not call dependencies again
      expect(llmProviderService.initialize).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('generateResponse', () => {
    it('should generate response using LLM provider', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.5 };
      
      const result = await aiService.generateResponse(prompt, options);
      
      expect(result).toEqual({
        text: 'AI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
      expect(llmProviderService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.5,
        maxTokens: 2048
      });
    });

    it('should use default options when not provided', async () => {
      const prompt = 'Test prompt';
      
      await aiService.generateResponse(prompt);
      
      expect(llmProviderService.generateCompletion).toHaveBeenCalledWith(prompt, {
        temperature: 0.7,
        maxTokens: 2048
      });
    });

    it('should use circuit breaker for AI calls', async () => {
      const prompt = 'Test prompt';
      
      await aiService.generateResponse(prompt);
      
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        'ai:generate',
        expect.any(Function),
        expect.any(Function)
      );
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
      
      const result = await aiService.generateResponse(prompt);
      
      expect(result).toEqual(cachedResponse);
      expect(cacheService.get).toHaveBeenCalled();
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cache hit for AI request', expect.any(Object));
    });

    it('should cache responses when caching is enabled', async () => {
      const prompt = 'Test prompt';
      
      await aiService.generateResponse(prompt);
      
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should not cache responses when caching is disabled', async () => {
      // Temporarily modify config
      const originalCacheResponses = config.ai.cacheResponses;
      config.ai.cacheResponses = false;
      
      const prompt = 'Test prompt';
      
      await aiService.generateResponse(prompt);
      
      expect(cacheService.set).not.toHaveBeenCalled();
      
      // Restore config
      config.ai.cacheResponses = originalCacheResponses;
    });

    it('should not cache responses when temperature is high', async () => {
      const prompt = 'Test prompt';
      const options = { temperature: 0.9 }; // High temperature = more randomness
      
      await aiService.generateResponse(prompt, options);
      
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should detect and handle PHI in prompt', async () => {
      phiDetector.containsPHI.mockReturnValue(true);
      
      const prompt = 'Test prompt with PHI';
      
      await expect(aiService.generateResponse(prompt)).rejects.toThrow('PHI detected message');
      
      expect(phiDetector.containsPHI).toHaveBeenCalledWith(prompt);
      expect(phiDetector.getPHIDetectionMessage).toHaveBeenCalledWith('input');
      expect(phiDetector.logPHIDetection).toHaveBeenCalledWith('aiService', {
        action: 'generateResponse'
      });
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });

    it('should skip PHI detection when disabled', async () => {
      // Temporarily modify config
      const originalPhiDetection = config.ai.phiDetection;
      config.ai.phiDetection = false;
      
      phiDetector.containsPHI.mockReturnValue(true);
      
      const prompt = 'Test prompt with PHI';
      
      await aiService.generateResponse(prompt);
      
      expect(phiDetector.containsPHI).not.toHaveBeenCalled();
      expect(llmProviderService.generateCompletion).toHaveBeenCalled();
      
      // Restore config
      config.ai.phiDetection = originalPhiDetection;
    });

    it('should handle errors gracefully', async () => {
      // Mock circuit breaker to throw error
      circuitBreaker.execute.mockRejectedValue(new Error('Service error'));
      
      const prompt = 'Test prompt';
      
      await expect(aiService.generateResponse(prompt)).rejects.toThrow('Service error');
      
      expect(logger.error).toHaveBeenCalledWith('Error generating AI response', {
        error: expect.any(Error)
      });
    });
  });

  describe('generateConversationResponse', () => {
    it('should generate response for conversation', async () => {
      const conversation = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];
      const options = { temperature: 0.5 };
      
      const result = await aiService.generateConversationResponse(conversation, options);
      
      expect(result).toEqual({
        text: 'AI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
      expect(llmProviderService.generateCompletion).toHaveBeenCalledWith(
        expect.any(String),
        {
          temperature: 0.5,
          maxTokens: 2048,
          conversation: conversation
        }
      );
    });

    it('should detect and handle PHI in conversation', async () => {
      phiDetector.containsPHI.mockImplementation((text) => {
        return text.includes('How are you?'); // Only detect PHI in the last message
      });
      
      const conversation = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];
      
      await expect(aiService.generateConversationResponse(conversation)).rejects.toThrow('PHI detected message');
      
      expect(phiDetector.containsPHI).toHaveBeenCalledWith('How are you?');
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle empty conversation', async () => {
      const conversation = [];
      
      await expect(aiService.generateConversationResponse(conversation)).rejects.toThrow('Conversation cannot be empty');
      
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle invalid conversation format', async () => {
      const conversation = 'Not an array';
      
      await expect(aiService.generateConversationResponse(conversation)).rejects.toThrow('Conversation must be an array');
      
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });
  });

  describe('generatePersonaResponse', () => {
    it('should generate response with persona', async () => {
      const prompt = 'Test prompt';
      const persona = {
        name: 'Ayla',
        description: 'A helpful assistant',
        systemPrompt: 'You are Ayla, a helpful assistant.'
      };
      const options = { temperature: 0.5 };
      
      const result = await aiService.generatePersonaResponse(prompt, persona, options);
      
      expect(result).toEqual({
        text: 'AI response',
        usage: { total_tokens: 100 },
        provider: 'openai'
      });
      expect(llmProviderService.generateCompletion).toHaveBeenCalledWith(
        expect.stringContaining('You are Ayla, a helpful assistant.'),
        {
          temperature: 0.5,
          maxTokens: 2048
        }
      );
    });

    it('should handle missing persona', async () => {
      const prompt = 'Test prompt';
      
      await expect(aiService.generatePersonaResponse(prompt)).rejects.toThrow('Persona is required');
      
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle invalid persona format', async () => {
      const prompt = 'Test prompt';
      const persona = 'Not an object';
      
      await expect(aiService.generatePersonaResponse(prompt, persona)).rejects.toThrow('Persona must be an object');
      
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle missing system prompt', async () => {
      const prompt = 'Test prompt';
      const persona = {
        name: 'Ayla',
        description: 'A helpful assistant'
        // Missing systemPrompt
      };
      
      await expect(aiService.generatePersonaResponse(prompt, persona)).rejects.toThrow('Persona must have a systemPrompt');
      
      expect(llmProviderService.generateCompletion).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset the service state', async () => {
      // First initialize
      await aiService.initialize();
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Reset
      aiService.reset();
      
      // Should be able to initialize again
      await aiService.initialize();
      
      expect(llmProviderService.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('AI service initialized');
    });
  });
});
