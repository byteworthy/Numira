const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const cacheService = require('../../services/cacheService');
const llmProviderService = require('../../services/llmProviderService');

// Use the existing Prisma client
const prisma = new PrismaClient();

/**
 * @route   GET /api/health
 * @desc    Get system health status
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.server.env,
      services: {
        api: {
          status: 'ok',
          uptime: process.uptime()
        },
        database: {
          status: 'unknown'
        },
        redis: {
          status: 'unknown'
        }
      },
      features: {
        offlineMode: config.features.offlineMode,
        pushNotifications: config.features.pushNotifications,
        familyPlans: config.features.familyPlans,
        multilingualSupport: config.features.multilingualSupport,
        aiFailover: config.features.aiFailover
      }
    };

    // Check database connection using existing Prisma client
    try {
      const result = await prisma.$queryRaw`SELECT NOW()`;
      
      if (result && result.length > 0) {
        status.services.database = {
          status: 'ok',
          timestamp: result[0].now
        };
      }
    } catch (dbError) {
      logger.error('Database health check failed', { error: dbError.message });
      status.services.database = {
        status: 'error',
        message: 'Database connection failed',
        error: dbError.message
      };
      status.status = 'degraded';
    }

    // Check Redis connection using existing cacheService
    try {
      const redisStats = await cacheService.getStats();
      
      if (redisStats && !redisStats.error) {
        status.services.redis = {
          status: 'ok',
          info: {
            size: redisStats.size
          }
        };
      } else {
        throw new Error(redisStats.error || 'Unknown Redis error');
      }
    } catch (redisError) {
      logger.error('Redis health check failed', { error: redisError.message });
      status.services.redis = {
        status: 'error',
        message: 'Redis connection failed',
        error: redisError.message
      };
      status.status = 'degraded';
    }
    
    // Check OpenAI connection
    try {
      const providerStatus = llmProviderService.getProviderStatus();
      status.services.openai = {
        status: providerStatus.openai && providerStatus.openai.available ? 'ok' : 'error',
        circuitOpen: providerStatus.openai ? providerStatus.openai.circuitOpen : true
      };
      
      if (status.services.openai.status === 'error') {
        status.status = 'degraded';
      }
    } catch (openaiError) {
      logger.error('OpenAI health check failed', { error: openaiError.message });
      status.services.openai = {
        status: 'error',
        message: 'OpenAI connection check failed',
        error: openaiError.message
      };
      status.status = 'degraded';
    }

    // Determine overall status
    if (status.services.database.status === 'error' && status.services.redis.status === 'error') {
      status.status = 'critical';
    }

    // Return appropriate status code
    const statusCode = status.status === 'ok' ? 200 : (status.status === 'degraded' ? 200 : 500);
    return res.status(statusCode).json(status);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @route   GET /api/health/detailed
 * @desc    Get detailed system health status
 * @access  Private (Admin only)
 */
router.get('/detailed', async (req, res) => {
  try {
    // Basic health check
    const basicHealth = await getBasicHealth();
    
    // Additional detailed information
    const detailedStatus = {
      ...basicHealth,
      system: {
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      queues: await getQueueStatus()
    };
    
    // Return appropriate status code
    const statusCode = detailedStatus.status === 'ok' ? 200 : (detailedStatus.status === 'degraded' ? 200 : 500);
    return res.status(statusCode).json(detailedStatus);
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Get basic health status using existing connections
 * @returns {Promise<Object>} Basic health status
 */
async function getBasicHealth() {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    services: {
      api: {
        status: 'ok',
        uptime: process.uptime()
      },
      database: {
        status: 'unknown'
      },
      redis: {
        status: 'unknown'
      },
      openai: {
        status: 'unknown'
      }
    }
  };

  // Check database connection using existing Prisma client
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    
    if (result && result.length > 0) {
      status.services.database = {
        status: 'ok',
        timestamp: result[0].now
      };
    }
  } catch (dbError) {
    logger.error('Database health check failed', { error: dbError.message });
    status.services.database = {
      status: 'error',
      message: 'Database connection failed',
      error: dbError.message
    };
    status.status = 'degraded';
  }

  // Check Redis connection using existing cacheService
  try {
    const redisStats = await cacheService.getStats();
    
    if (redisStats && !redisStats.error) {
      status.services.redis = {
        status: 'ok',
        info: {
          size: redisStats.size
        }
      };
    } else {
      throw new Error(redisStats.error || 'Unknown Redis error');
    }
  } catch (redisError) {
    logger.error('Redis health check failed', { error: redisError.message });
    status.services.redis = {
      status: 'error',
      message: 'Redis connection failed',
      error: redisError.message
    };
    status.status = 'degraded';
  }
  
  // Check OpenAI connection
  try {
    const providerStatus = llmProviderService.getProviderStatus();
    status.services.openai = {
      status: providerStatus.openai && providerStatus.openai.available ? 'ok' : 'error',
      circuitOpen: providerStatus.openai ? providerStatus.openai.circuitOpen : true
    };
    
    if (status.services.openai.status === 'error') {
      status.status = 'degraded';
    }
  } catch (openaiError) {
    logger.error('OpenAI health check failed', { error: openaiError.message });
    status.services.openai = {
      status: 'error',
      message: 'OpenAI connection check failed',
      error: openaiError.message
    };
    status.status = 'degraded';
  }

  // Determine overall status
  if ((status.services.database.status === 'error' && status.services.redis.status === 'error') || 
      (status.services.database.status === 'error' && status.services.openai.status === 'error') ||
      (status.services.redis.status === 'error' && status.services.openai.status === 'error')) {
    status.status = 'critical';
  }

  return status;
}

/**
 * Get queue status
 * @returns {Promise<Object>} Queue status
 */
async function getQueueStatus() {
  try {
    const queueService = require('../../services/queueService');
    const queues = [
      queueService.emailQueue,
      queueService.reportQueue,
      queueService.cleanupQueue,
      queueService.notificationQueue
    ];
    
    const queueStatus = {};
    
    for (const queue of queues) {
      const counts = await queue.getJobCounts();
      queueStatus[queue.name] = {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        paused: counts.paused
      };
    }
    
    return queueStatus;
  } catch (error) {
    logger.error('Queue status check failed', { error: error.message });
    return {
      status: 'error',
      message: 'Queue status check failed',
      error: error.message
    };
  }
}

module.exports = router;
