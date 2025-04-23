/**
 * LLM Provider Service
 * 
 * A unified service for interacting with various LLM providers (OpenAI, Anthropic, etc.)
 * with optimized handling, fallback mechanisms, and performance monitoring.
 * 
 * Features:
 * - Multi-provider support with dynamic fallback
 * - Streaming support for real-time responses
 * - Automatic retries with exponential backoff
 * - Circuit breaker pattern to prevent cascading failures
 * - Token usage tracking and optimization
 * - Dynamic model selection based on input complexity
 */

const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const winston = require('winston');
const config = require('../config/config');
const cacheService = require('./cacheService');
const circuitBreaker = require('./circuitBreaker');

// Initialize LLM clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.ai.openai.timeout,
});

// Initialize Anthropic client if API key is available
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

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
  openai: {
    name: 'OpenAI',
    available: !!process.env.OPENAI_API_KEY,
    models: {
      'gpt-4': {
        contextWindow: 8192,
        costPer1kTokens: 0.03,
        priority: 1,
        capabilities: ['high-reasoning', 'complex-instructions', 'nuanced-response']
      },
      'gpt-4-turbo': {
        contextWindow: 128000,
        costPer1kTokens: 0.01,
        priority: 2,
        capabilities: ['high-reasoning', 'complex-instructions', 'nuanced-response', 'large-context']
      },
      'gpt-3.5-turbo': {
        contextWindow: 16385,
        costPer1kTokens: 0.0015,
        priority: 3,
        capabilities: ['basic-reasoning', 'standard-instructions']
      }
    },
    defaultModel: 'gpt-4'
  },
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
  openai: circuitBreaker.createBreaker('openai', breakerConfig),
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
 * @param {string} preferredProvider - Optional preferred provider
 * @param {string} preferredModel - Optional preferred model
 * @returns {Object} - Selected provider and model
 */
function selectModel(systemPrompt, userInput, preferredProvider = null, preferredModel = null) {
  // Estimate total tokens
  const totalTokens = estimateTokenCount(systemPrompt) + estimateTokenCount(userInput);
  
  // Check if a specific provider and model are requested and available
  if (preferredProvider && preferredModel) {
    const provider = providers[preferredProvider];
    if (provider && provider.available && provider.models[preferredModel]) {
      // Check if the model can handle the token count
      if (totalTokens <= provider.models[preferredModel].contextWindow) {
        return {
          provider: preferredProvider,
          model: preferredModel
        };
      }
    }
  }
  
  // Determine input complexity based on length and characteristics
  const complexity = calculateComplexity(userInput);
  
  // Get available providers
  const availableProviders = Object.entries(providers)
    .filter(([_, provider]) => provider.available)
    .map(([key, _]) => key);
  
  if (availableProviders.length === 0) {
    throw new Error('No LLM providers are available');
  }
  
  // Filter out providers with open circuit breakers
  const healthyProviders = availableProviders.filter(provider => 
    !breakers[provider].isOpen()
  );
  
  // If all circuits are open, use the first available provider anyway
  // (circuit breaker will allow a test request)
  const candidateProviders = healthyProviders.length > 0 ? 
    healthyProviders : [availableProviders[0]];
  
  // For each candidate provider, find the best model based on complexity and token count
  let bestProvider = null;
  let bestModel = null;
  let bestPriority = Infinity;
  
  for (const providerKey of candidateProviders) {
    const provider = providers[providerKey];
    
    // Find models that can handle the token count and complexity
    const suitableModels = Object.entries(provider.models)
      .filter(([_, model]) => totalTokens <= model.contextWindow)
      .filter(([_, model]) => isModelSuitableForComplexity(model, complexity));
    
    if (suitableModels.length > 0) {
      // Find the highest priority (lowest number) model
      const [modelName, model] = suitableModels.reduce((best, current) => {
        return current[1].priority < best[1].priority ? current : best;
      }, suitableModels[0]);
      
      if (model.priority < bestPriority) {
        bestProvider = providerKey;
        bestModel = modelName;
        bestPriority = model.priority;
      }
    }
  }
  
  // If no suitable model found, use the default model of the first available provider
  if (!bestProvider || !bestModel) {
    bestProvider = candidateProviders[0];
    bestModel = providers[bestProvider].defaultModel;
    
    // Log that we're using a fallback model
    logger.warn('No ideal model found for input, using default', {
      provider: bestProvider,
      model: bestModel,
      estimatedTokens: totalTokens
    });
  }
  
  return {
    provider: bestProvider,
    model: bestModel
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
 * Call OpenAI API with retry logic
 * 
 * @param {string} model - The model to use
 * @param {Array} messages - The messages array
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The API response
 */
async function callOpenAIWithRetry(model, messages, options = {}) {
  let attempt = 0;
  let delay = retryConfig.initialDelayMs;
  
  while (attempt < retryConfig.maxRetries) {
    try {
      // Use circuit breaker to call OpenAI
      return await breakers.openai.execute(async () => {
        const response = await openai.chat.completions.create({
          model,
          messages,
          temperature: options.temperature || config.ai.openai.temperature,
          max_tokens: options.maxTokens || config.ai.openai.maxTokens,
          stream: options.stream || false
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
      logger.warn(`OpenAI API call failed, retrying (${attempt}/${retryConfig.maxRetries})`, {
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
 * Get AI response with automatic provider selection and fallback
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.systemPrompt - The system prompt
 * @param {string} params.userInput - The user input
 * @param {string} [params.preferredProvider] - Optional preferred provider
 * @param {string} [params.preferredModel] - Optional preferred model
 * @param {boolean} [params.stream=false] - Whether to stream the response
 * @returns {Promise<string>} - The AI response
 */
async function getAIResponse(params) {
  const { systemPrompt, userInput, preferredProvider, preferredModel, stream = false } = params;
  
  // Start timing for performance logging
  const startTime = Date.now();
  
  try {
    // Select the best model based on input complexity
    const { provider, model } = selectModel(
      systemPrompt,
      userInput,
      preferredProvider,
      preferredModel
    );
    
    // Generate cache key for this request
    const cacheKey = `llm:${provider}:${model}:${cacheService.generateCacheKey('prompt', {
      system: systemPrompt,
      user: userInput
    })}`;
    
    // Skip cache for streaming responses
    if (stream) {
      return await generateResponse(provider, model, systemPrompt, userInput, { stream });
    }
    
    // Try to get from cache first
    const cachedResponse = await cacheService.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Cache hit for AI response', {
        provider,
        model,
        cacheKey
      });
      
      return cachedResponse;
    }
    
    // Generate response if not in cache
    logger.debug('Cache miss for AI response', {
      provider,
      model,
      cacheKey
    });
    
    const response = await generateResponse(provider, model, systemPrompt, userInput);
    
    // Cache the response
    const ttl = config.cache.aiResponseTtl || 86400; // Default 24 hours
    await cacheService.set(cacheKey, response, ttl);
    
    // Calculate and log response time
    const responseTime = Date.now() - startTime;
    logger.info('AI response generated', {
      provider,
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
    
    // Try fallback if available
    if (error.message.includes('OpenAI') && providers.anthropic.available) {
      logger.info('Falling back to Anthropic');
      return await fallbackToAnthropic(systemPrompt, userInput);
    } else if (error.message.includes('Anthropic') && providers.openai.available) {
      logger.info('Falling back to OpenAI');
      return await fallbackToOpenAI(systemPrompt, userInput);
    }
    
    throw new Error(`AI service error: ${error.message}`);
  }
}

/**
 * Generate response based on provider
 * 
 * @param {string} provider - The provider to use
 * @param {string} model - The model to use
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - The AI response
 */
async function generateResponse(provider, model, systemPrompt, userInput, options = {}) {
  switch (provider) {
    case 'openai':
      const openaiResponse = await callOpenAIWithRetry(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        options
      );
      
      return options.stream ? openaiResponse : openaiResponse.choices[0].message.content;
      
    case 'anthropic':
      const anthropicResponse = await callAnthropicWithRetry(
        model,
        systemPrompt,
        userInput,
        options
      );
      
      return options.stream ? anthropicResponse : anthropicResponse.content[0].text;
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Fallback to OpenAI when Anthropic fails
 * 
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @returns {Promise<string>} - The AI response
 */
async function fallbackToOpenAI(systemPrompt, userInput) {
  const model = providers.openai.defaultModel;
  
  const response = await callOpenAIWithRetry(
    model,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ]
  );
  
  return response.choices[0].message.content;
}

/**
 * Fallback to Anthropic when OpenAI fails
 * 
 * @param {string} systemPrompt - The system prompt
 * @param {string} userInput - The user input
 * @returns {Promise<string>} - The AI response
 */
async function fallbackToAnthropic(systemPrompt, userInput) {
  const model = providers.anthropic.defaultModel;
  
  const response = await callAnthropicWithRetry(
    model,
    systemPrompt,
    userInput
  );
  
  return response.content[0].text;
}

/**
 * Get available providers and their status
 * 
 * @returns {Object} - Provider status information
 */
function getProviderStatus() {
  const status = {};
  
  for (const [key, provider] of Object.entries(providers)) {
    if (provider.available) {
      status[key] = {
        name: provider.name,
        available: true,
        circuitOpen: breakers[key].isOpen(),
        models: Object.keys(provider.models),
        defaultModel: provider.defaultModel
      };
    } else {
      status[key] = {
        name: provider.name,
        available: false
      };
    }
  }
  
  return status;
}

module.exports = {
  getAIResponse,
  getProviderStatus,
  estimateTokenCount,
  selectModel
};
