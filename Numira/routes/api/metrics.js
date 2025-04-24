/**
 * Metrics API Routes
 * 
 * Provides endpoints to get system metrics and statistics.
 */

const express = require('express');
const router = express.Router();
const prom = require('prom-client');

// Create a Registry to register metrics
const register = new prom.Registry();

// Add default metrics (CPU, memory, etc.)
prom.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);

/**
 * Record HTTP request duration
 * 
 * @param {string} method - HTTP method
 * @param {string} route - Route path
 * @param {number} statusCode - HTTP status code
 * @param {number} duration - Request duration in seconds
 */
function recordHttpRequest(method, route, statusCode, duration) {
  httpRequestDurationMicroseconds
    .labels(method, route, statusCode)
    .observe(duration);
}
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const os = require('os');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const logger = require('../../utils/logger');
const openaiProxy = require('../../services/openaiProxy');
const queueService = require('../../services/queueService');
const cacheService = require('../../services/cacheService');
const auditLogger = require('../../utils/auditLogger');

/**
 * @route   GET /api/metrics
 * @desc    Get system metrics (public, limited info)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Get basic system status
    const status = {
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting public metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/system
 * @desc    Get detailed system metrics
 * @access  Private (Admin)
 */
router.get('/system', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get system metrics
    const metrics = {
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
        processUptime: Math.floor(os.uptime()),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        usedMemory: process.memoryUsage(),
        cpuUsage: os.loadavg(),
        cpuCount: os.cpus().length
      },
      process: {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        resourceUsage: process.resourceUsage ? process.resourceUsage() : null
      }
    };
    
    // Get disk usage (Unix-like systems only)
    if (process.platform !== 'win32') {
      try {
        const { stdout } = await exec('df -h / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        metrics.system.diskTotal = parts[1];
        metrics.system.diskUsed = parts[2];
        metrics.system.diskFree = parts[3];
        metrics.system.diskUsage = parts[4];
      } catch (diskError) {
        logger.warn('Error getting disk usage', { error: diskError.message });
      }
    }
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_system_metrics' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.INTERNAL
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting system metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/database
 * @desc    Get database metrics
 * @access  Private (Admin)
 */
router.get('/database', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get database metrics
    const metrics = {
      counts: {},
      recentActivity: {}
    };
    
    // Get entity counts
    const [
      userCount,
      conversationCount,
      messageCount,
      insightCount,
      sessionCount,
      subscriptionCount,
      familyCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.insight.count(),
      prisma.session.count(),
      prisma.subscription.count(),
      prisma.family.count()
    ]);
    
    metrics.counts = {
      users: userCount,
      conversations: conversationCount,
      messages: messageCount,
      insights: insightCount,
      sessions: sessionCount,
      subscriptions: subscriptionCount,
      families: familyCount
    };
    
    // Get recent activity
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const [
      newUsers,
      newConversations,
      newMessages,
      newInsights
    ] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: oneDayAgo
          }
        }
      }),
      prisma.conversation.count({
        where: {
          createdAt: {
            gte: oneDayAgo
          }
        }
      }),
      prisma.message.count({
        where: {
          createdAt: {
            gte: oneDayAgo
          }
        }
      }),
      prisma.insight.count({
        where: {
          createdAt: {
            gte: oneDayAgo
          }
        }
      })
    ]);
    
    metrics.recentActivity = {
      newUsers,
      newConversations,
      newMessages,
      newInsights
    };
    
    // Get database size and stats (if available)
    try {
      // This is PostgreSQL specific
      const dbStats = await prisma.$queryRaw`
        SELECT
          pg_database_size(current_database()) as db_size,
          (SELECT count(*) FROM pg_stat_activity) as connections
      `;
      
      if (dbStats && dbStats[0]) {
        metrics.database = {
          size: dbStats[0].db_size,
          connections: dbStats[0].connections,
          sizeFormatted: formatBytes(dbStats[0].db_size)
        };
      }
    } catch (dbStatsError) {
      logger.warn('Error getting database stats', { error: dbStatsError.message });
    }
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_database_metrics' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.INTERNAL
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting database metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/ai
 * @desc    Get AI usage metrics
 * @access  Private (Admin)
 */
router.get('/ai', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get AI usage metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const metrics = await openaiProxy.getUsageStats({
      startDate: thirtyDaysAgo
    });
    
    // Add persona usage
    const personaUsage = await prisma.conversation.groupBy({
      by: ['personaId'],
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });
    
    metrics.personaUsage = personaUsage.map(item => ({
      personaId: item.personaId,
      count: item._count._all
    }));
    
    // Add room usage
    const roomUsage = await prisma.conversation.groupBy({
      by: ['roomId'],
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });
    
    metrics.roomUsage = roomUsage.map(item => ({
      roomId: item.roomId,
      count: item._count._all
    }));
    
    // Get PHI detection metrics from logs
    try {
      // Query logs for PHI detection events
      const phiLogs = await prisma.logEntry.findMany({
        where: {
          level: 'warn',
          message: {
            contains: 'Potential PHI detected'
          },
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100 // Limit to most recent 100 entries
      });
      
      // Group PHI detections by day
      const phiByDay = {};
      phiLogs.forEach(log => {
        const day = log.createdAt.toISOString().split('T')[0];
        phiByDay[day] = (phiByDay[day] || 0) + 1;
      });
      
      // Group by persona and room if available in metadata
      const phiByPersona = {};
      const phiByRoom = {};
      
      phiLogs.forEach(log => {
        try {
          const metadata = typeof log.metadata === 'string' 
            ? JSON.parse(log.metadata) 
            : log.metadata;
          
          if (metadata && metadata.personaId) {
            phiByPersona[metadata.personaId] = (phiByPersona[metadata.personaId] || 0) + 1;
          }
          
          if (metadata && metadata.roomId) {
            phiByRoom[metadata.roomId] = (phiByRoom[metadata.roomId] || 0) + 1;
          }
        } catch (e) {
          // Skip if metadata can't be parsed
        }
      });
      
      // Add PHI metrics to response
      metrics.phiDetection = {
        total: phiLogs.length,
        byDay: Object.entries(phiByDay).map(([day, count]) => ({ day, count })),
        byPersona: Object.entries(phiByPersona).map(([personaId, count]) => ({ personaId, count })),
        byRoom: Object.entries(phiByRoom).map(([roomId, count]) => ({ roomId, count }))
      };
    } catch (phiError) {
      logger.error('Error getting PHI detection metrics', { error: phiError.message });
      // Don't fail the whole request if PHI metrics fail
      metrics.phiDetection = { error: 'Failed to retrieve PHI detection metrics' };
    }
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_ai_metrics' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.INTERNAL
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting AI metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/queues
 * @desc    Get queue metrics
 * @access  Private (Admin)
 */
router.get('/queues', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get queue metrics
    const metrics = {
      email: {},
      notification: {},
      report: {},
      cleanup: {}
    };
    
    // Get queue counts
    const [
      emailCounts,
      notificationCounts,
      reportCounts,
      cleanupCounts
    ] = await Promise.all([
      queueService.getQueueCounts('email'),
      queueService.getQueueCounts('notification'),
      queueService.getQueueCounts('report'),
      queueService.getQueueCounts('cleanup')
    ]);
    
    metrics.email = emailCounts;
    metrics.notification = notificationCounts;
    metrics.report = reportCounts;
    metrics.cleanup = cleanupCounts;
    
    // Get Redis info
    try {
      const redisInfo = await cacheService.getRedisInfo();
      metrics.redis = redisInfo;
    } catch (redisError) {
      logger.warn('Error getting Redis info', { error: redisError.message });
    }
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_queue_metrics' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.INTERNAL
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting queue metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/audit
 * @desc    Get audit log metrics
 * @access  Private (Admin)
 */
router.get('/audit', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get audit log metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get event type counts
    const eventTypeCounts = await prisma.auditLog.groupBy({
      by: ['eventType'],
      _count: {
        _all: true
      },
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });
    
    // Get outcome counts
    const outcomeCounts = await prisma.auditLog.groupBy({
      by: ['outcome'],
      _count: {
        _all: true
      },
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });
    
    // Get sensitivity counts
    const sensitivityCounts = await prisma.auditLog.groupBy({
      by: ['sensitivity'],
      _count: {
        _all: true
      },
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });
    
    // Get daily counts
    const dailyCounts = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as day,
        COUNT(*) as count
      FROM "AuditLog"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day DESC
    `;
    
    const metrics = {
      eventTypeCounts: eventTypeCounts.map(item => ({
        eventType: item.eventType,
        count: item._count._all
      })),
      outcomeCounts: outcomeCounts.map(item => ({
        outcome: item.outcome,
        count: item._count._all
      })),
      sensitivityCounts: sensitivityCounts.map(item => ({
        sensitivity: item.sensitivity,
        count: item._count._all
      })),
      dailyCounts
    };
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_audit_metrics' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.SENSITIVE
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting audit metrics', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/metrics/summary
 * @desc    Get a human-readable summary of system metrics
 * @access  Private (Admin)
 */
router.get('/summary', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get system metrics
    const uptime = Math.floor(process.uptime());
    const uptimeStr = formatUptime(uptime);
    const memUsage = process.memoryUsage();
    const memUsageStr = `${formatBytes(memUsage.rss)} (RSS)`;
    
    // Get database counts
    const [
      userCount,
      activeUserCount,
      conversationCount,
      messageCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          }
        }
      }),
      prisma.conversation.count(),
      prisma.message.count()
    ]);
    
    // Get AI usage
    const aiUsage = await openaiProxy.getUsageStats();
    
    // Get queue counts
    const queueCounts = {
      email: await queueService.getQueueCounts('email'),
      notification: await queueService.getQueueCounts('notification')
    };
    
    // Format the summary
    const summary = {
      timestamp: new Date().toISOString(),
      system: {
        status: 'healthy',
        uptime: uptimeStr,
        memory: memUsageStr,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        users: userCount,
        activeUsers: activeUserCount,
        conversations: conversationCount,
        messages: messageCount,
        messagesPerUser: userCount ? (messageCount / userCount).toFixed(1) : '0',
        conversationsPerUser: userCount ? (conversationCount / userCount).toFixed(1) : '0'
      },
      ai: {
        totalRequests: aiUsage.totalRequests,
        totalTokens: aiUsage.models.reduce((sum, model) => sum + model.totalTokens, 0),
        estimatedCost: `$${aiUsage.totalCost.toFixed(2)}`
      },
      queues: {
        emailWaiting: queueCounts.email.waiting,
        emailActive: queueCounts.email.active,
        notificationWaiting: queueCounts.notification.waiting,
        notificationActive: queueCounts.notification.active
      }
    };
    
    // Log the metrics request
    auditLogger.log(auditLogger.EVENT_TYPES.ADMIN_ACTION, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { action: 'view_metrics_summary' },
      sensitivity: auditLogger.SENSITIVITY_LEVELS.INTERNAL
    });
    
    res.json(summary);
  } catch (error) {
    logger.error('Error getting metrics summary', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format uptime to human-readable string
 * 
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Add Prometheus metrics endpoint
router.get('/prometheus', (req, res) => {
  res.set('Content-Type', register.contentType);
  register.metrics().then(data => res.end(data));
});

module.exports = { router, recordHttpRequest };
