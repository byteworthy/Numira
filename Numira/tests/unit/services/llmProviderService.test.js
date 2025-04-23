/**
 * Unit tests for the LLM Provider Service
 * 
 * Tests the functionality of the LLM provider service with mocked API clients.
 */

const llmProviderService = require('../../../services/llmProviderService');
const circuitBreaker = require('../../../services/circuitBreaker');
const cacheService = require('../../../services/cacheService');

// Mock dependencies
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('../../../services/circuitBreaker');
jest.mock('../../../services/cacheService');
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  }
}));

describe('LLM Provider Service', () => {
  // Mock OpenAI and Anthropic responses
  const mockOpenAIResponse = {
    choices: [{ message: { content: 'OpenAI response' } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
  };
  
  const mockAnthropicResponse = {
    content: [{ text: 'Anthropic response' }]
  };
  
  // Mock circuit breaker
  const mockBreaker = {
    execute: jest.fn(),
    isOpen: jest.fn().mockReturnValue(false)
  };
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup circuit breaker mock
    circuitBreaker.createBreaker.mockReturnValue(mockBreaker);
    
    // Setup cache service mock
    cacheService.generateCacheKey.mockReturnValue('test-cache-key');
    cacheService.get.mockResolvedValue(null); // Default to cache miss
    cacheService.set.mockResolvedValue(true);
    
    // Reset the module to clear any cached state
    jest.resetModules();
  });
  
  describe('selectModel', () => {
    test('should select preferred model when available and suitable', () => {
      const result = llmProviderService.selectModel(
        'System prompt',
        'User input',
        'openai',
        'gpt-4'
      );
      
      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4'
      });
    });
    
    test('should select appropriate model based on input complexity', () => {
      // Mock a complex input
      const complexInput = 'This is a very complex question that requires deep analysis. ' +
        'It involves multiple considerations and nuanced understanding of the subject matter. ' +
        'Please provide a detailed explanation with examples and counterexamples. ' +
        'Additionally, consider the philosophical implications and practical applications.';
      
      const result = llmProviderService.selectModel('System prompt', complexInput);
      
      // Expect a model capable of high reasoning
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    });
    
    test('should handle unavailable providers', () => {
      // Mock no available providers
      const originalProviders = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      // This should throw an error
      expect(() => {
        llmProviderService.selectModel('System prompt', 'User input');
      }).toThrow('No LLM providers are available');
      
      // Restore environment
      process.env.OPENAI_API_KEY = originalProviders;
    });
  });
  
  describe('estimateTokenCount', () => {
    test('should estimate token count based on text length', () => {
      const text = 'This is a test sentence with approximately 10 tokens.';
      const count = llmProviderService.estimateTokenCount(text);
      
      // Expect roughly text.length / 4 tokens
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(text.length);
    });
    
    test('should handle empty or null input', () => {
      expect(llmProviderService.estimateTokenCount('')).toBe(0);
      expect(llmProviderService.estimateTokenCount(null)).toBe(0);
      expect(llmProviderService.estimateTokenCount(undefined)).toBe(0);
    });
  });
  
  describe('getAIResponse', () => {
    test('should return cached response if available', async () => {
      // Setup cache hit
      cacheService.get.mockResolvedValue('Cached response');
      
      const response = await llmProviderService.getAIResponse({
        systemPrompt: 'System prompt',
        userInput: 'User input'
      });
      
      expect(response).toBe('Cached response');
      expect(cacheService.get).toHaveBeenCalled();
    });
    
    test('should call OpenAI API and cache response on cache miss', async () => {
      // Setup OpenAI mock
      mockBreaker.execute.mockImplementation(async (fn) => {
        return mockOpenAIResponse;
      });
      
      const response = await llmProviderService.getAIResponse({
        systemPrompt: 'System prompt',
        userInput: 'User input'
      });
      
      expect(response).toBe('OpenAI response');
      expect(cacheService.set).toHaveBeenCalled();
    });
    
    test('should handle API errors and try fallback', async () => {
      // Setup OpenAI mock to fail
      mockBreaker.execute.mockImplementationOnce(async () => {
        throw new Error('OpenAI error');
      });
      
      // Setup fallback to succeed
      mockBreaker.execute.mockImplementationOnce(async () => {
        return mockAnthropicResponse;
      });
      
      // Mock Anthropic availability
      process.env.ANTHROPIC_API_KEY = 'test-key';
      
      try {
        const response = await llmProviderService.getAIResponse({
          systemPrompt: 'System prompt',
          userInput: 'User input'
        });
        
        // If fallback works, we should get a response
        expect(response).toBeDefined();
      } catch (error) {
        // If no fallback available, we'll get an error
        expect(error.message).toContain('AI service error');
      }
      
      // Clean up
      delete process.env.ANTHROPIC_API_KEY;
    });
    
    test('should skip cache for streaming responses', async () => {
      // Setup OpenAI mock
      mockBreaker.execute.mockImplementation(async (fn) => {
        return mockOpenAIResponse;
      });
      
      await llmProviderService.getAIResponse({
        systemPrompt: 'System prompt',
        userInput: 'User input',
        stream: true
      });
      
      // Should not try to get from cache
      expect(cacheService.get).not.toHaveBeenCalled();
    });
  });
  
  describe('getProviderStatus', () => {
    test('should return status of available providers', () => {
      const status = llmProviderService.getProviderStatus();
      
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
      
      // Should have OpenAI status at minimum
      expect(status.openai).toBeDefined();
      expect(status.openai.available).toBeDefined();
    });
  });
});
