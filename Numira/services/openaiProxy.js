/**
 * OpenAI Proxy Service
 * 
 * A centralized service for handling all OpenAI API requests with:
 * - Consistent error handling
 * - Automatic retries
 * - Fallback from GPT-4 to GPT-3.5 when needed
 * - Logging of anonymized prompts, token usage, and latency
 * - Circuit breaker pattern to prevent cascading failures
 * - Rate limiting to stay within API quotas
 */

const { Configuration, OpenAIApi } = require('openai');
const crypto = require('crypto');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLogger');
const circuitBreaker = require('./circuitBreaker');
const cacheService = require('./cacheService');
const config = require('../config/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Initialize OpenAI API client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION_ID
});
const openai = new OpenAIApi(configuration);

// Configure circuit breaker for OpenAI API
const openaiBreaker = circuitBreaker.createBreaker('openai', {
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
});

// Log circuit breaker creation
logger.info('Circuit breaker created for OpenAI', {
  name: 'openai',
  failureThreshold: 3,
  resetTimeout: 30000
});

/**
 * Calculate token usage for a prompt and response
 * 
 * Note: This is an approximation. For precise counts, use the OpenAI tokenizer.
 * 
 * @param {Object} messages - Chat messages
 * @param {string} model - Model name
 * @param {string} response - Model response
 * @returns {Object} Token usage estimation
 */
function estimateTokenUsage(messages, model, response) {
  // Approximation: 1 token ≈ 4 characters for English text
  const charToTokenRatio = 4;
  
  // Calculate prompt tokens
  let promptText = '';
  messages.forEach(msg => {
    promptText += msg.content;
  });
  
  const promptTokens = Math.ceil(promptText.length / charToTokenRatio);
  const completionTokens = Math.ceil((response?.length || 0) / charToTokenRatio);
  const totalTokens = promptTokens + completionTokens;
  
  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

/**
 * Hash a prompt for anonymized logging
 * 
 * @param {Array} messages - Chat messages
 * @returns {string} Hashed prompt
 */
function hashPrompt(messages) {
  // Convert messages to string and hash
  const promptText = JSON.stringify(messages);
  return crypto.createHash('sha256').update(promptText).digest('hex').substring(0, 16);
}

/**
 * Log API usage to database
 * 
 * @param {Object} data - Usage data
 * @returns {Promise<Object>} Created log entry
 */
async function logApiUsage(data) {
  try {
    const {
      userId,
      orgId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      promptHash,
      latencyMs,
      status,
      error
    } = data;
    
    // Create usage log in database
    return await prisma.apiUsageLog.create({
      data: {
        userId,
        orgId,
        provider: 'openai',
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        promptHash,
        latencyMs,
        status,
        error: error || null
      }
    });
  } catch (logError) {
    logger.error('Failed to log API usage', { error: logError.message });
    // Don't throw, logging should not break the application flow
    return null;
  }
}

/**
 * OpenAI Proxy Service
 */
const openaiProxy = {
  /**
   * Create a chat completion
   * 
   * @param {Object} params - OpenAI API parameters
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID
   * @param {string} options.orgId - Organization ID
   * @param {boolean} options.useCache - Whether to use cache
   * @param {number} options.cacheTtl - Cache TTL in seconds
   * @param {boolean} isFallback - Whether this is a fallback call
   * @returns {Promise<Object>} OpenAI API response
   */
  async createChatCompletion(params, options = {}, isFallback = false) {
    const {
      userId,
      orgId,
      useCache = false,
      cacheTtl = 3600 // 1 hour default
    } = options;
    
    const startTime = Date.now();
    let status = 'success';
    let errorMessage = null;
    let response = null;
    let tokenUsage = null;
    
    try {
      // Generate a cache key if caching is enabled
      let cacheKey = null;
      if (useCache) {
        cacheKey = `openai:${params.model}:${hashPrompt(params.messages)}`;
        
        // Try to get from cache
        const cachedResponse = await cacheService.get(cacheKey);
        if (cachedResponse) {
          logger.debug('Using cached OpenAI response', { model: params.model });
          
          // Log cache hit to API usage
          tokenUsage = estimateTokenUsage(
            params.messages, 
            params.model, 
            cachedResponse.choices[0]?.message?.content
          );
          
          await logApiUsage({
            userId,
            orgId,
            model: params.model,
            promptTokens: tokenUsage.promptTokens,
            completionTokens: tokenUsage.completionTokens,
            totalTokens: tokenUsage.totalTokens,
            promptHash: hashPrompt(params.messages),
            latencyMs: 0, // Cache hit has no latency
            status: 'cache_hit'
          });
          
          return cachedResponse;
        }
      }
      
      // Log anonymized prompt to audit log
      if (userId) {
        auditLogger.aiPrompt(userId, null, null, {
          model: params.model,
          isFallback
        });
      }
      
      // Make the API call through the circuit breaker
      response = await openaiBreaker.execute(async () => {
        return await openai.createChatCompletion(params);
      });
      
      // Extract the response data
      const responseData = response.data;
      
      // Get token usage from the response
      tokenUsage = {
        promptTokens: responseData.usage?.prompt_tokens || 0,
        completionTokens: responseData.usage?.completion_tokens || 0,
        totalTokens: responseData.usage?.total_tokens || 0
      };
      
      // If no usage info from API, estimate it
      if (tokenUsage.totalTokens === 0) {
        tokenUsage = estimateTokenUsage(
          params.messages, 
          params.model, 
          responseData.choices[0]?.message?.content
        );
      }
      
      // Cache the response if caching is enabled
      if (useCache && cacheKey) {
        await cacheService.set(cacheKey, responseData, cacheTtl);
      }
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log API usage
      await logApiUsage({
        userId,
        orgId,
        model: params.model,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        promptHash: hashPrompt(params.messages),
        latencyMs: responseTime,
        status
      });
      
      // Log detailed metrics for monitoring
      logger.info('OpenAI API call metrics', {
        model: params.model,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        latencyMs: responseTime,
        status,
        // Anonymize user ID for logging
        userIdHash: userId ? crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8) : 'anonymous'
      });
      
      return responseData;
    } catch (error) {
      status = 'error';
      errorMessage = error.message;
      
      // Log the error
      logger.error('OpenAI API error', { 
        error: error.message, 
        model: params.model,
        isFallback
      });
      
      // Log to audit log
      if (userId) {
        auditLogger.aiError(userId, null, null, error.message, {
          model: params.model,
          isFallback
        });
      }
      
      // Estimate token usage for error logging
      if (!tokenUsage) {
        tokenUsage = estimateTokenUsage(params.messages, params.model, '');
      }
      
      // Log API usage with error
      await logApiUsage({
        userId,
        orgId,
        model: params.model,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: 0,
        totalTokens: tokenUsage.promptTokens,
        promptHash: hashPrompt(params.messages),
        latencyMs: Date.now() - startTime,
        status,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Create an embedding
   * 
   * @param {Object} params - OpenAI API parameters
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID
   * @param {string} options.orgId - Organization ID
   * @returns {Promise<Object>} OpenAI API response
   */
  async createEmbedding(params, options = {}) {
    const { userId, orgId } = options;
    
    const startTime = Date.now();
    let status = 'success';
    let errorMessage = null;
    
    try {
      // Make the API call
      const response = await openai.createEmbedding(params);
      const responseData = response.data;
      
      // Log API usage
      await logApiUsage({
        userId,
        orgId,
        model: params.model,
        promptTokens: responseData.usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: responseData.usage?.total_tokens || 0,
        promptHash: hashPrompt([{ content: params.input }]),
        latencyMs: Date.now() - startTime,
        status
      });
      
      return responseData;
    } catch (error) {
      status = 'error';
      errorMessage = error.message;
      
      // Log the error
      logger.error('OpenAI Embedding API error', { 
        error: error.message, 
        model: params.model
      });
      
      // Log API usage with error
      await logApiUsage({
        userId,
        orgId,
        model: params.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        promptHash: hashPrompt([{ content: params.input }]),
        latencyMs: Date.now() - startTime,
        status,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Create a moderation
   * 
   * @param {Object} params - OpenAI API parameters
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID
   * @param {string} options.orgId - Organization ID
   * @returns {Promise<Object>} OpenAI API response
   */
  async createModeration(params, options = {}) {
    const { userId, orgId } = options;
    
    const startTime = Date.now();
    let status = 'success';
    let errorMessage = null;
    
    try {
      // Make the API call
      const response = await openai.createModeration(params);
      const responseData = response.data;
      
      // Log API usage (moderations don't report token usage)
      await logApiUsage({
        userId,
        orgId,
        model: 'text-moderation-latest',
        promptTokens: params.input.length / 4, // Rough estimate
        completionTokens: 0,
        totalTokens: params.input.length / 4,
        promptHash: hashPrompt([{ content: params.input }]),
        latencyMs: Date.now() - startTime,
        status
      });
      
      return responseData;
    } catch (error) {
      status = 'error';
      errorMessage = error.message;
      
      // Log the error
      logger.error('OpenAI Moderation API error', { 
        error: error.message
      });
      
      // Log API usage with error
      await logApiUsage({
        userId,
        orgId,
        model: 'text-moderation-latest',
        promptTokens: params.input.length / 4, // Rough estimate
        completionTokens: 0,
        totalTokens: params.input.length / 4,
        promptHash: hashPrompt([{ content: params.input }]),
        latencyMs: Date.now() - startTime,
        status,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get usage statistics
   * 
   * @param {Object} filters - Filters to apply
   * @param {string} filters.userId - Filter by user ID
   * @param {string} filters.orgId - Filter by organization ID
   * @param {string} filters.model - Filter by model
   * @param {string} filters.status - Filter by status
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(filters = {}) {
    try {
      const {
        userId,
        orgId,
        model,
        status,
        startDate,
        endDate
      } = filters;
      
      // Build where clause
      const where = { provider: 'openai' };
      if (userId) where.userId = userId;
      if (orgId) where.orgId = orgId;
      if (model) where.model = model;
      if (status) where.status = status;
      
      // Date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }
      
      // Get total counts
      const totalCount = await prisma.apiUsageLog.count({ where });
      
      // Get aggregated stats
      const stats = await prisma.$queryRaw`
        SELECT 
          model,
          status,
          COUNT(*) as requestCount,
          SUM(promptTokens) as totalPromptTokens,
          SUM(completionTokens) as totalCompletionTokens,
          SUM(totalTokens) as totalTokens,
          AVG(latencyMs) as avgLatencyMs
        FROM "ApiUsageLog"
        WHERE provider = 'openai'
          ${userId ? prisma.sql`AND "userId" = ${userId}` : prisma.sql``}
          ${orgId ? prisma.sql`AND "orgId" = ${orgId}` : prisma.sql``}
          ${model ? prisma.sql`AND model = ${model}` : prisma.sql``}
          ${status ? prisma.sql`AND status = ${status}` : prisma.sql``}
          ${startDate ? prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : prisma.sql``}
          ${endDate ? prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : prisma.sql``}
        GROUP BY model, status
        ORDER BY totalTokens DESC
      `;
      
      // Calculate cost estimates (approximate)
      const costEstimates = stats.map(stat => {
        let costPer1kPromptTokens = 0;
        let costPer1kCompletionTokens = 0;
        
        // Set pricing based on model
        // These are approximate and may need to be updated
        if (stat.model.includes('gpt-4')) {
          costPer1kPromptTokens = 0.03;
          costPer1kCompletionTokens = 0.06;
        } else if (stat.model.includes('gpt-3.5-turbo')) {
          costPer1kPromptTokens = 0.0015;
          costPer1kCompletionTokens = 0.002;
        } else if (stat.model.includes('text-embedding')) {
          costPer1kPromptTokens = 0.0001;
          costPer1kCompletionTokens = 0;
        }
        
        const promptCost = (stat.totalPromptTokens / 1000) * costPer1kPromptTokens;
        const completionCost = (stat.totalCompletionTokens / 1000) * costPer1kCompletionTokens;
        const totalCost = promptCost + completionCost;
        
        return {
          ...stat,
          costEstimate: {
            promptCost,
            completionCost,
            totalCost
          }
        };
      });
      
      return {
        totalRequests: totalCount,
        models: costEstimates,
        totalCost: costEstimates.reduce((sum, stat) => sum + stat.costEstimate.totalCost, 0)
      };
    } catch (error) {
      logger.error('Error getting OpenAI usage stats', { error: error.message });
      throw error;
    }
  }
};

module.exports = openaiProxy;
