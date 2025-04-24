/**
 * LLM Provider Service using Anthropic Claude
 * 
 * A service for interacting with Anthropic's Claude AI models through the Anthropic API.
 * This service provides a unified interface for sending prompts to Claude and handling responses,
 * with features like caching, circuit breaking, and error handling.
 * 
 * @module llmProviderService
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const winston = require('winston');
const config = require('../config/config');
const cacheService = require('./cacheService');
const circuitBreaker = require('./circuitBreaker');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'llm-provider-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/llm-provider-service.log' })
  ],
});

/**
 * Provider configurations with models and their capabilities
 */
const providers = {
  anthropic: {
    name: 'Anthropic',
    available: !!process.env.ANTHROPIC_API_KEY,
    models: {
      'claude-3-opus': {
        contextWindow: 200000,
        costPer1kTokens: 0.015,
        priority: 1,
        capabilities: ['high-reasoning', 'complex-instructions', 'nuanced-response', 'large-context']
      },
      'claude-3-sonnet': {
        contextWindow: 200000,
        costPer1kTokens: 0.003,
        priority: 2,
        capabilities: ['high-reasoning', 'complex-instructions', 'nuanced-response', 'large-context']
      },
      'claude-3-haiku': {
        contextWindow: 200000,
        costPer1kTokens: 0.00025,
        priority: 3,
        capabilities: ['basic-reasoning', 'standard-instructions', 'large-context']
      }
    },
    defaultModel: 'claude-3-sonnet'
  }
};

/**
 * Retry configuration for API calls
 */
const retryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 8000, // 8 seconds
  backoffFactor: 2, // Exponential backoff
};

/**
 * Circuit breaker configuration
 */
const breakerConfig = {
  failureThreshold: 5, // Number of failures before opening circuit
  resetTimeout: 30000, // 30 seconds before trying again
};

// Initialize circuit breakers for each provider
const breakers = {
  anthropic: circuitBreaker.createBreaker('anthropic', breakerConfig)
};

/**
 * Estimate token count for a given text
 * This is a rough estimate - actual token count may vary
 * 
 * @param {string} text - The text to estimate tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokenCount(text) {
  if (!text) return 0;
  // A rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Select the best model based on input complexity and available providers
 * 
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @param {string} preferredModel - Optional preferred model
 * @returns {Object} - Selected model
 */
function selectModel(systemPrompt, userInput, preferredModel = null) {
  // Estimate total tokens
  const totalTokens = estimateTokenCount(systemPrompt) + estimateTokenCount(userInput);
  
  // Check if a specific model is requested and available
  if (preferredModel) {
    const provider = providers.anthropic;
    if (provider && provider.available && provider.models[preferredModel]) {
      // Check if the model can handle the token count
      if (totalTokens <= provider.models[preferredModel].contextWindow) {
        return {
          model: preferredModel
        };
      }
    }
  }
  
  // Determine input complexity based on length and characteristics
  const complexity = calculateComplexity(userInput);
  
  // Check if Anthropic is available
  if (!providers.anthropic.available) {
    throw new Error('Anthropic provider is not available');
  }
  
  // Filter out providers with open circuit breakers
  const isHealthy = !breakers.anthropic.isOpen();
  
  // If circuit is open, allow a test request
  if (!isHealthy) {
    logger.warn('Anthropic circuit breaker is open, allowing test request');
  }
  
  // Find the best model based on complexity and token count
  const provider = providers.anthropic;
  
  // Find models that can handle the token count and complexity
  const suitableModels = Object.entries(provider.models)
    .filter(([_, model]) => totalTokens <= model.contextWindow)
    .filter(([_, model]) => isModelSuitableForComplexity(model, complexity));
  
  if (suitableModels.length > 0) {
    // Find the highest priority (lowest number) model
    const [modelName, _] = suitableModels.reduce((best, current) => {
      return current[1].priority < best[1].priority ? current : best;
    }, suitableModels[0]);
    
    return {
      model: modelName
    };
  }
  
  // If no suitable model found, use the default model
  const defaultModel = providers.anthropic.defaultModel;
  
  // Log that we're using a fallback model
  logger.warn('No ideal model found for input, using default', {
    model: defaultModel,
    estimatedTokens: totalTokens
  });
  
  return {
    model: defaultModel
  };
}

/**
 * Calculate the complexity of user input
 * 
 * @param {string} userInput - The user input text
 * @returns {string} - Complexity level: 'low', 'medium', or 'high'
 */
function calculateComplexity(userInput) {
  if (!userInput) return 'low';
  
  // Calculate complexity based on various factors
  const length = userInput.length;
  const sentenceCount = (userInput.match(/[.!?]+/g) || []).length;
  const wordCount = userInput.split(/\s+/).length;
  const avgWordLength = length / (wordCount || 1);
  const questionCount = (userInput.match(/\?/g) || []).length;
  const complexWordPattern = /\b[a-zA-Z]{10,}\b/g;
  const complexWordCount = (userInput.match(complexWordPattern) || []).length;
  
  // Weighted scoring
  let complexityScore = 0;
  
  if (length > 500) complexityScore += 2;
  else if (length > 200) complexityScore += 1;
  
  if (sentenceCount > 10) complexityScore += 2;
  else if (sentenceCount > 5) complexityScore += 1;
  
  if (avgWordLength > 6) complexityScore += 2;
  else if (avgWordLength > 5) complexityScore += 1;
  
  if (questionCount > 3) complexityScore += 2;
  else if (questionCount > 1) complexityScore += 1;
  
  if (complexWordCount > 5) complexityScore += 2;
  else if (complexWordCount > 2) complexityScore += 1;
  
  // Determine complexity level
  if (complexityScore >= 6) return 'high';
  if (complexityScore >= 3) return 'medium';
  return 'low';
}

/**
 * Check if a model is suitable for the given complexity
 * 
 * @param {Object} model - The model object
 * @param {string} complexity - The complexity level
 * @returns {boolean} - Whether the model is suitable
 */
function isModelSuitableForComplexity(model, complexity) {
  switch (complexity) {
    case 'high':
      return model.capabilities.includes('high-reasoning') && 
             model.capabilities.includes('complex-instructions');
    case 'medium':
      return model.capabilities.includes('high-reasoning') || 
             model.capabilities.includes('complex-instructions');
    case 'low':
    default:
      return true; // Any model can handle low complexity
  }
}

/**
 * Check if an error is retryable
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryableError(error) {
  // Retry on rate limit errors, server errors, and network errors
  if (error.status === 429 || error.status >= 500 || error.code === 'ECONNRESET') {
    return true;
  }
  
  // Check for specific error messages
  const retryableMessages = [
    'rate limit',
    'timeout',
    'server error',
    'overloaded',
    'try again',
    'too many requests'
  ];
  
  return retryableMessages.some(msg => 
    error.message && error.message.toLowerCase().includes(msg)
  );
}

/**
 * Call Anthropic API with retry logic
 * 
 * @param {string} model - The model to use
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The API response
 */
async function callAnthropicWithRetry(model, systemPrompt, userInput, options = {}) {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized');
  }
  
  let attempt = 0;
  let delay = retryConfig.initialDelayMs;
  
  while (attempt < retryConfig.maxRetries) {
    try {
      // Use circuit breaker to call Anthropic
      return await breakers.anthropic.execute(async () => {
        const response = await anthropic.messages.create({
          model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userInput }],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000
        });
        
        return response;
      });
    } catch (error) {
      attempt++;
      
      // If it's the last attempt, throw the error
      if (attempt >= retryConfig.maxRetries) {
        throw error;
      }
      
      // Check if the error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Log retry attempt
      logger.warn(`Anthropic API call failed, retrying (${attempt}/${retryConfig.maxRetries})`, {
        error: error.message,
        model,
        attempt
      });
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxDelayMs);
    }
  }
}

/**
 * Get AI response from Anthropic
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.systemPrompt - The system prompt
 * @param {string} params.userInput - The user input
 * @param {string} [params.preferredModel] - Optional preferred model
 * @param {boolean} [params.stream=false] - Whether to stream the response
 * @returns {Promise<string>} - The AI response
 */
async function getAIResponse(params) {
  const { systemPrompt, userInput, preferredModel, stream = false } = params;
  
  // Start timing for performance logging
  const startTime = Date.now();
  
  try {
    // Select the best model based on input complexity
    const { model } = selectModel(
      systemPrompt,
      userInput,
      preferredModel
    );
    
    // Generate cache key for this request
    const cacheKey = `llm:anthropic:${model}:${cacheService.generateCacheKey('prompt', {
      system: systemPrompt,
      user: userInput
    })}`;
    
    // Skip cache for streaming responses
    if (stream) {
      return await generateResponse(model, systemPrompt, userInput, { stream });
    }
    
    // Try to get from cache first
    const cachedResponse = await cacheService.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Cache hit for AI response', {
        model,
        cacheKey
      });
      
      return cachedResponse;
    }
    
    // Generate response if not in cache
    logger.debug('Cache miss for AI response', {
      model,
      cacheKey
    });
    
    const response = await generateResponse(model, systemPrompt, userInput);
    
    // Cache the response
    const ttl = config.cache.aiResponseTtl || 86400; // Default 24 hours
    await cacheService.set(cacheKey, response, ttl);
    
    // Calculate and log response time
    const responseTime = Date.now() - startTime;
    logger.info('AI response generated', {
      model,
      responseTime,
      estimatedTokens: estimateTokenCount(systemPrompt) + estimateTokenCount(userInput) + estimateTokenCount(response)
    });
    
    return response;
  } catch (error) {
    // Log error
    logger.error('Error generating AI response', {
      error: error.message,
      stack: error.stack
    });
    
    throw new Error(`AI service error: ${error.message}`);
  }
}

/**
 * Generate response using Anthropic
 * 
 * @param {string} model - The model to use
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - The AI response
 */
async function generateResponse(model, systemPrompt, userInput, options = {}) {
  const anthropicResponse = await callAnthropicWithRetry(
    model,
    systemPrompt,
    userInput,
    options
  );
  
  return options.stream ? anthropicResponse : anthropicResponse.content[0].text;
}

/**
 * Get available providers and their status
 * 
 * @returns {Object} - Provider status information
 */
function getProviderStatus() {
  const status = {};
  
  const provider = providers.anthropic;
  if (provider.available) {
    status.anthropic = {
      name: provider.name,
      available: true,
      circuitOpen: breakers.anthropic.isOpen(),
      models: Object.keys(provider.models),
      defaultModel: provider.defaultModel
    };
  } else {
    status.anthropic = {
      name: provider.name,
      available: false
    };
  }
  
  return status;
}

module.exports = {
  getAIResponse,
  getProviderStatus,
  estimateTokenCount,
  selectModel,
  anthropic
};
