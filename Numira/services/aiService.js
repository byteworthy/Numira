/**
 * AI Service for Numira
 * 
 * Handles interactions with LLM providers for generating responses
 * based on user input, selected persona, and room context.
 * 
 * This service implements:
 * - Persona and room context integration
 * - Input sanitization and PHI detection
 * - Rate limiting
 * - LLM provider integration with optimized handling
 * - Secure logging
 */

const winston = require('winston');
const personas = require('../config/personas');
const rooms = require('../config/rooms');
const cacheService = require('./cacheService');
const llmProviderService = require('./llmProviderService');
const journalService = require('./journalService');
const analyticsService = require('./analyticsService');
const phiDetector = require('../utils/phiDetector');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ai-service.log' })
  ],
});

// In-memory rate limiting store
// In production, this should be replaced with Redis or another distributed solution
const rateLimitStore = new Map();
const RATE_LIMIT = {
  maxRequests: 20,  // Maximum requests per window
  windowMs: 3600000 // 1 hour in milliseconds
};

// PHI detection is now handled by the centralized phiDetector utility

/**
 * Enforces rate limiting for a user
 * 
 * @param {string} userId - The user's ID
 * @returns {boolean} - True if the request is allowed, false if rate limited
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userRateLimit = rateLimitStore.get(userId) || { 
    count: 0, 
    resetAt: now + RATE_LIMIT.windowMs 
  };
  
  // Reset counter if the window has expired
  if (now > userRateLimit.resetAt) {
    userRateLimit.count = 0;
    userRateLimit.resetAt = now + RATE_LIMIT.windowMs;
  }
  
  // Check if user has exceeded rate limit
  if (userRateLimit.count >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  // Increment counter and update store
  userRateLimit.count++;
  rateLimitStore.set(userId, userRateLimit);
  
  return true;
}

/**
 * Builds the system prompt for LLM based on persona and room
 * 
 * @param {Object} persona - The selected persona object
 * @param {Object} room - The selected room object
 * @returns {string} - The complete system prompt
 */
function buildSystemPrompt(persona, room) {
  if (!persona || !room) {
    throw new Error('Invalid persona or room configuration');
  }
  
  // Start with the persona's system prompt
  let systemPrompt = persona.systemPrompt;
  
  // Append room context
  systemPrompt += `\n\nCONTEXT: You are in the ${room.name}. ${room.purpose}\n`;
  
  // Add room-specific instructions based on promptType
  switch (room.promptType) {
    case 'open':
      systemPrompt += 'This is an open-ended space for exploration. Allow the conversation to flow naturally.\n';
      break;
    case 'guided':
      systemPrompt += 'This is a guided space. Provide structure and direction to help the user navigate their thoughts.\n';
      break;
    case 'short_form':
      systemPrompt += 'This is a short-form space. Keep responses concise and focused.\n';
      break;
    case 'targeted':
      systemPrompt += 'This is a targeted space. Focus specifically on addressing the user\'s stated concern or question.\n';
      break;
  }
  
  // Add non-clinical disclaimer
  systemPrompt += '\nIMPORTANT: You are not a medical professional and may not offer therapy or medical advice. Your role is a self-reflection companion only. Do not diagnose, treat, or suggest medical interventions.';
  
  return systemPrompt;
}

/**
 * Main function to get AI response based on user input, persona, and room
 * Now with optimized LLM provider integration and caching
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.userInput - The user's input text
 * @param {string} params.personaId - The selected persona ID
 * @param {string} params.roomId - The selected room ID
 * @param {string} [params.userId='anonymous'] - The user's ID for rate limiting
 * @param {boolean} [params.saveToJournal=false] - Whether to save the conversation to the journal
 * @returns {Promise<string>} - The AI response
 */
async function getAIResponse({ userInput, personaId, roomId, userId = 'anonymous', saveToJournal = false }) {
  try {
    // Start timing for performance logging
    const startTime = Date.now();
    
    // Validate inputs
    if (!userInput || !personaId || !roomId) {
      throw new Error('Missing required parameters: userInput, personaId, or roomId');
    }
    
    // Check rate limit
    if (!checkRateLimit(userId)) {
      logger.warn('Rate limit exceeded', { userId });
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Find persona and room
    const persona = personas.find(p => p.id === personaId);
    const room = rooms.find(r => r.id === roomId);
    
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`);
    }
    
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    
    // Check if persona supports this room
    if (!room.supportedPersonas.includes(personaId)) {
      throw new Error(`Persona ${personaId} is not compatible with room ${roomId}`);
    }
    
    // Sanitize user input
    const sanitizedInput = phiDetector.sanitizeInput(userInput);
    
    // Check for PHI
    if (phiDetector.containsPHI(userInput)) {
      phiDetector.logPHIDetection('aiService', {
        personaId,
        roomId,
        userId
      });
      
      return phiDetector.getPHIDetectionMessage('input');
    }
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(persona, room);
    
    // Generate cache key for this request
    const cacheKey = cacheService.generateCacheKey('ai-response', {
      input: sanitizedInput,
      persona: personaId,
      room: roomId
    });
    
    // Try to get from cache first
    const cachedResponse = await cacheService.get(cacheKey);
    if (cachedResponse) {
      logger.debug('Cache hit for AI response', {
        personaId,
        roomId,
        cacheKey
      });
      
      // Track interaction with analytics service
      analyticsService.trackInteraction({
        userId,
        personaId,
        roomId,
        interactionType: 'conversation',
        metadata: {
          cached: true,
          inputLength: sanitizedInput.length,
          responseLength: cachedResponse.length
        }
      }).catch(err => {
        // Log error but don't fail the request
        logger.error('Failed to track interaction', { error: err.message });
      });
      
      // Save to journal if needed (even for cached responses)
      if (saveToJournal && userId !== 'anonymous') {
        await saveToJournalSafely(userId, personaId, roomId, sanitizedInput, cachedResponse);
      }
      
      return cachedResponse;
    }
    
    // Cache miss - generate response using LLM provider service
    logger.debug('Cache miss for AI response', {
      personaId,
      roomId,
      cacheKey
    });
    
    // Use the LLM provider service to get a response
    const aiResponseData = await llmProviderService.getAIResponse({
      systemPrompt,
      userInput: sanitizedInput
    });
    
    // Extract response and token counts
    const aiResponse = aiResponseData.response || aiResponseData;
    const promptTokens = aiResponseData.promptTokens || 0;
    const completionTokens = aiResponseData.completionTokens || 0;
    const totalTokens = aiResponseData.totalTokens || 0;
    const model = aiResponseData.model || 'unknown';
    
    // Cache the response
    const ttl = 3600; // 1 hour
    await cacheService.set(cacheKey, aiResponse, ttl);
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Log metadata (not full prompt or response)
    logger.info('AI response generated', {
      personaId,
      roomId,
      userId,
      responseTime,
      totalTokens,
      model,
      success: true
    });
    
    // Track interaction with analytics service
    analyticsService.trackInteraction({
      userId,
      personaId,
      roomId,
      interactionType: 'conversation',
      metadata: {
        cached: false,
        inputLength: sanitizedInput.length,
        responseLength: aiResponse.length
      }
    }).catch(err => {
      // Log error but don't fail the request
      logger.error('Failed to track interaction', { error: err.message });
    });
    
    // Track AI response metrics
    analyticsService.trackAIResponse({
      userId,
      personaId,
      roomId,
      responseTime,
      promptTokens,
      completionTokens,
      totalTokens,
      model,
      cached: false
    }).catch(err => {
      // Log error but don't fail the request
      logger.error('Failed to track AI response metrics', { error: err.message });
    });
    
    // Save to journal if requested and user is authenticated (not anonymous)
    if (saveToJournal && userId !== 'anonymous') {
      await saveToJournalSafely(userId, personaId, roomId, sanitizedInput, aiResponse);
    }
    
    return aiResponse;
  } catch (error) {
    // Log error
    logger.error('Error generating AI response', {
      personaId,
      roomId,
      userId,
      error: error.message,
      success: false
    });
    
    // Return user-friendly error message
    if (error.message.includes('Rate limit')) {
      throw error; // Pass through rate limit errors
    } else {
      throw new Error('Unable to generate a response. Please try again later.');
    }
  }
}

/**
 * Helper function to safely save conversation to journal
 * 
 * @param {string} userId - The user ID
 * @param {string} personaId - The persona ID
 * @param {string} roomId - The room ID
 * @param {string} userInput - The user input
 * @param {string} aiResponse - The AI response
 */
async function saveToJournalSafely(userId, personaId, roomId, userInput, aiResponse) {
  try {
    await journalService.createJournalEntry(
      userId,
      personaId,
      roomId,
      userInput,
      aiResponse
    );
    
    logger.info('Conversation saved to journal', {
      userId,
      personaId,
      roomId
    });
  } catch (journalError) {
    // Log error but don't fail the request
    logger.error('Failed to save conversation to journal', {
      error: journalError.message,
      userId,
      personaId,
      roomId
    });
    // We don't throw here to avoid failing the main request
  }
}

/**
 * Get information about the AI service status
 * 
 * @returns {Object} - Status information
 */
function getServiceStatus() {
  return {
    rateLimit: {
      maxRequests: RATE_LIMIT.maxRequests,
      windowMs: RATE_LIMIT.windowMs,
      activeUsers: rateLimitStore.size
    },
    providers: llmProviderService.getProviderStatus()
  };
}

module.exports = {
  getAIResponse,
  getServiceStatus
};
