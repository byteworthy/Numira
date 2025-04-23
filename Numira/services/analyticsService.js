/**
 * Analytics Service for Numira
 * 
 * Handles tracking and retrieving analytics data for user interactions,
 * AI usage, and system performance metrics.
 * 
 * This service implements:
 * - User interaction tracking
 * - AI response metrics tracking
 * - Analytics data retrieval
 * - Data cleanup for old analytics records
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'analytics-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics-service.log' })
  ],
});

/**
 * Track user interaction with personas and rooms
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.userId - The user ID
 * @param {string} params.personaId - The persona ID
 * @param {string} params.roomId - The room ID
 * @param {string} params.interactionType - The type of interaction (e.g., 'conversation', 'journal')
 * @param {Object} [params.metadata] - Additional metadata about the interaction
 * @returns {Promise<Object>} - The created analytics record
 */
async function trackInteraction({ userId, personaId, roomId, interactionType, metadata = {} }) {
  try {
    // Create analytics record
    const analytics = await prisma.analytics.create({
      data: {
        userId,
        personaId,
        roomId,
        interactionType,
        metadata
      }
    });
    
    logger.debug('Interaction tracked', {
      userId,
      personaId,
      roomId,
      interactionType
    });
    
    return analytics;
  } catch (error) {
    logger.error('Error tracking interaction', {
      error: error.message,
      userId,
      personaId,
      roomId,
      interactionType
    });
    
    throw new Error(`Failed to track interaction: ${error.message}`);
  }
}

/**
 * Track AI response metrics
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.userId - The user ID
 * @param {string} params.personaId - The persona ID
 * @param {string} params.roomId - The room ID
 * @param {number} params.responseTime - Response time in milliseconds
 * @param {number} params.promptTokens - Number of prompt tokens
 * @param {number} params.completionTokens - Number of completion tokens
 * @param {number} params.totalTokens - Total number of tokens
 * @param {string} params.model - The model used (e.g., 'gpt-4')
 * @param {boolean} [params.cached=false] - Whether the response was cached
 * @returns {Promise<Object>} - The created AI metrics record
 */
async function trackAIResponse({
  userId,
  personaId,
  roomId,
  responseTime,
  promptTokens,
  completionTokens,
  totalTokens,
  model,
  cached = false
}) {
  try {
    // Create AI metrics record
    const aiMetrics = await prisma.aIMetrics.create({
      data: {
        userId,
        personaId,
        roomId,
        responseTime,
        promptTokens,
        completionTokens,
        totalTokens,
        model,
        cached
      }
    });
    
    logger.debug('AI response metrics tracked', {
      userId,
      personaId,
      roomId,
      model,
      totalTokens,
      cached
    });
    
    return aiMetrics;
  } catch (error) {
    logger.error('Error tracking AI response metrics', {
      error: error.message,
      userId,
      personaId,
      roomId,
      model
    });
    
    throw new Error(`Failed to track AI response metrics: ${error.message}`);
  }
}

/**
 * Get persona usage statistics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Array>} - Array of persona usage statistics
 */
async function getPersonaStats({ startDate, endDate } = {}) {
  try {
    // Build date filter if provided
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }
    
    // Query for persona usage
    const personaStats = await prisma.analytics.groupBy({
      by: ['personaId'],
      _count: {
        personaId: true
      },
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      orderBy: {
        _count: {
          personaId: 'desc'
        }
      }
    });
    
    // Get persona names
    const personas = await prisma.persona.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    // Map persona names to stats
    const result = personaStats.map(stat => {
      const persona = personas.find(p => p.id === stat.personaId) || { name: stat.personaId };
      return {
        personaId: stat.personaId,
        name: persona.name,
        count: stat._count.personaId
      };
    });
    
    return result;
  } catch (error) {
    logger.error('Error getting persona stats', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get persona stats: ${error.message}`);
  }
}

/**
 * Get room usage statistics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Array>} - Array of room usage statistics
 */
async function getRoomStats({ startDate, endDate } = {}) {
  try {
    // Build date filter if provided
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }
    
    // Query for room usage
    const roomStats = await prisma.analytics.groupBy({
      by: ['roomId'],
      _count: {
        roomId: true
      },
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      orderBy: {
        _count: {
          roomId: 'desc'
        }
      }
    });
    
    // Get room names
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    // Map room names to stats
    const result = roomStats.map(stat => {
      const room = rooms.find(r => r.id === stat.roomId) || { name: stat.roomId };
      return {
        roomId: stat.roomId,
        name: room.name,
        count: stat._count.roomId
      };
    });
    
    return result;
  } catch (error) {
    logger.error('Error getting room stats', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get room stats: ${error.message}`);
  }
}

/**
 * Get persona-room combination usage statistics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Array>} - Array of persona-room combination usage statistics
 */
async function getCombinationStats({ startDate, endDate } = {}) {
  try {
    // Build date filter if provided
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }
    
    // Query for persona-room combination usage
    const combinationStats = await prisma.analytics.groupBy({
      by: ['personaId', 'roomId'],
      _count: {
        _all: true
      },
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });
    
    // Get persona and room names
    const personas = await prisma.persona.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    // Map persona and room names to stats
    const result = combinationStats.map(stat => {
      const persona = personas.find(p => p.id === stat.personaId) || { name: stat.personaId };
      const room = rooms.find(r => r.id === stat.roomId) || { name: stat.roomId };
      
      return {
        personaId: stat.personaId,
        personaName: persona.name,
        roomId: stat.roomId,
        roomName: room.name,
        count: stat._count._all
      };
    });
    
    return result;
  } catch (error) {
    logger.error('Error getting combination stats', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get combination stats: ${error.message}`);
  }
}

/**
 * Get AI usage statistics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Object>} - AI usage statistics
 */
async function getAIStats({ startDate, endDate } = {}) {
  try {
    // Build date filter if provided
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }
    
    // Query for AI metrics
    const aiMetrics = await prisma.aIMetrics.findMany({
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      }
    });
    
    // Calculate statistics
    const totalRequests = aiMetrics.length;
    const promptTokens = aiMetrics.reduce((sum, metric) => sum + metric.promptTokens, 0);
    const completionTokens = aiMetrics.reduce((sum, metric) => sum + metric.completionTokens, 0);
    const totalTokens = aiMetrics.reduce((sum, metric) => sum + metric.totalTokens, 0);
    const totalResponseTime = aiMetrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0;
    
    const cacheHits = aiMetrics.filter(metric => metric.cached).length;
    const cacheMisses = totalRequests - cacheHits;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) + '%' : '0%';
    
    // Group by model
    const modelStats = {};
    aiMetrics.forEach(metric => {
      if (!modelStats[metric.model]) {
        modelStats[metric.model] = {
          name: metric.model,
          count: 0,
          totalTokens: 0,
          cost: 0
        };
      }
      
      modelStats[metric.model].count++;
      modelStats[metric.model].totalTokens += metric.totalTokens;
      
      // Estimate cost based on model
      // These are approximate costs and should be updated as pricing changes
      let cost = 0;
      if (metric.model.includes('gpt-4')) {
        // GPT-4 pricing (approximate)
        cost += metric.promptTokens * 0.00003; // $0.03 per 1K prompt tokens
        cost += metric.completionTokens * 0.00006; // $0.06 per 1K completion tokens
      } else if (metric.model.includes('gpt-3.5')) {
        // GPT-3.5 pricing (approximate)
        cost += metric.promptTokens * 0.000001; // $0.001 per 1K prompt tokens
        cost += metric.completionTokens * 0.000002; // $0.002 per 1K completion tokens
      } else if (metric.model.includes('claude')) {
        // Claude pricing (approximate)
        cost += metric.totalTokens * 0.00001; // $0.01 per 1K tokens (simplified)
      }
      
      modelStats[metric.model].cost += cost;
    });
    
    // Calculate total cost
    const totalCost = Object.values(modelStats).reduce((sum, model) => sum + model.cost, 0).toFixed(2);
    
    return {
      totalRequests,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens
      },
      averageResponseTime,
      cacheHitRate,
      cacheHits,
      cacheMisses,
      models: Object.values(modelStats),
      estimatedCost: totalCost
    };
  } catch (error) {
    logger.error('Error getting AI stats', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get AI stats: ${error.message}`);
  }
}

/**
 * Get user engagement statistics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Object>} - User engagement statistics
 */
async function getUserStats({ startDate, endDate } = {}) {
  try {
    // Build date filter if provided
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }
    
    // Query for user interactions
    const interactions = await prisma.analytics.findMany({
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      select: {
        userId: true,
        createdAt: true
      }
    });
    
    // Get unique users
    const uniqueUsers = [...new Set(interactions.map(interaction => interaction.userId))];
    const totalUsers = await prisma.user.count();
    const activeUsers = uniqueUsers.length;
    
    // Count interactions per user
    const userInteractions = {};
    interactions.forEach(interaction => {
      if (!userInteractions[interaction.userId]) {
        userInteractions[interaction.userId] = 0;
      }
      userInteractions[interaction.userId]++;
    });
    
    // Calculate average interactions per user
    const totalInteractions = interactions.length;
    const avgInteractionsPerUser = activeUsers > 0 ? (totalInteractions / activeUsers).toFixed(2) : '0';
    
    // Get top users by interaction count
    const topUsers = Object.entries(userInteractions)
      .map(([userId, count]) => ({ userId, interactionCount: count }))
      .sort((a, b) => b.interactionCount - a.interactionCount)
      .slice(0, 10);
    
    // Calculate interaction frequency distribution
    const interactionFrequency = {
      '1': 0,
      '2-5': 0,
      '6-10': 0,
      '11-20': 0,
      '21-50': 0,
      '51+': 0
    };
    
    Object.values(userInteractions).forEach(count => {
      if (count === 1) {
        interactionFrequency['1']++;
      } else if (count >= 2 && count <= 5) {
        interactionFrequency['2-5']++;
      } else if (count >= 6 && count <= 10) {
        interactionFrequency['6-10']++;
      } else if (count >= 11 && count <= 20) {
        interactionFrequency['11-20']++;
      } else if (count >= 21 && count <= 50) {
        interactionFrequency['21-50']++;
      } else {
        interactionFrequency['51+']++;
      }
    });
    
    // Count new users (registered during the period)
    let newUsers = 0;
    if (startDate && endDate) {
      newUsers = await prisma.user.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
    }
    
    return {
      totalUsers,
      activeUsers,
      newUsers,
      totalInteractions,
      avgInteractionsPerUser,
      topUsers,
      interactionFrequency
    };
  } catch (error) {
    logger.error('Error getting user stats', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get user stats: ${error.message}`);
  }
}

/**
 * Get summary of all analytics
 * 
 * @param {Object} [params] - The parameters object
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Object>} - Analytics summary
 */
async function getSummary({ startDate, endDate } = {}) {
  try {
    // Get all stats
    const [personaStats, roomStats, combinationStats, aiStats, userStats] = await Promise.all([
      getPersonaStats({ startDate, endDate }),
      getRoomStats({ startDate, endDate }),
      getCombinationStats({ startDate, endDate }),
      getAIStats({ startDate, endDate }),
      getUserStats({ startDate, endDate })
    ]);
    
    // Build summary
    return {
      dateRange: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      users: {
        total: userStats.totalUsers,
        active: userStats.activeUsers,
        new: userStats.newUsers,
        avgInteractionsPerUser: userStats.avgInteractionsPerUser
      },
      interactions: {
        total: userStats.totalInteractions,
        topPersonas: personaStats.slice(0, 5),
        topRooms: roomStats.slice(0, 5),
        topCombinations: combinationStats.slice(0, 5)
      },
      ai: {
        totalRequests: aiStats.totalRequests,
        totalTokens: aiStats.tokens.total,
        estimatedCost: `$${aiStats.estimatedCost}`,
        cacheHitRate: aiStats.cacheHitRate,
        avgResponseTime: `${(aiStats.averageResponseTime / 1000).toFixed(2)}s`
      }
    };
  } catch (error) {
    logger.error('Error getting analytics summary', {
      error: error.message,
      startDate,
      endDate
    });
    
    throw new Error(`Failed to get analytics summary: ${error.message}`);
  }
}

/**
 * Clean up old analytics data
 * 
 * @param {number} [retentionDays=90] - Number of days to retain data
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupOldAnalyticsData(retentionDays = 90) {
  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Delete old analytics records
    const deletedAnalytics = await prisma.analytics.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    
    // Delete old AI metrics records
    const deletedAIMetrics = await prisma.aIMetrics.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    
    logger.info('Cleaned up old analytics data', {
      retentionDays,
      deletedAnalytics: deletedAnalytics.count,
      deletedAIMetrics: deletedAIMetrics.count
    });
    
    return {
      success: true,
      deletedAnalytics: deletedAnalytics.count,
      deletedAIMetrics: deletedAIMetrics.count
    };
  } catch (error) {
    logger.error('Error cleaning up old analytics data', {
      error: error.message,
      retentionDays
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  trackInteraction,
  trackAIResponse,
  getPersonaStats,
  getRoomStats,
  getCombinationStats,
  getAIStats,
  getUserStats,
  getSummary,
  cleanupOldAnalyticsData
};
