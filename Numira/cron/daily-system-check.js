/**
 * Daily System Check
 * 
 * This script runs daily to check the system health and send a report.
 * It is scheduled via the cron system and can also be run manually.
 * 
 * Usage: node cron/daily-system-check.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const os = require('os');
const logger = require('../utils/logger');
const openaiProxy = require('../services/openaiProxy');
const queueService = require('../services/queueService');
const cacheService = require('../services/cacheService');
const analyticsService = require('../services/analyticsService');
const postmarkService = require('../services/postmarkService');
const config = require('../config/config');

// Admin email to send reports to
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@numira.app';

/**
 * Main function to run the daily system check
 */
async function runDailySystemCheck() {
  logger.info('Starting daily system check');
  
  try {
    // Get system metrics
    const metrics = {
      system: {
        uptime: Math.floor(process.uptime()),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuUsage: os.loadavg(),
        cpuCount: os.cpus().length
      },
      database: {
        users: await prisma.user.count(),
        conversations: await prisma.conversation.count(),
        messages: await prisma.message.count()
      }
    };
    
    // Clean up old analytics data (keep 90 days)
    logger.info('Cleaning up old analytics data');
    const analyticsCleanupResult = await analyticsService.cleanupOldAnalyticsData(90);
    
    if (analyticsCleanupResult.success) {
      logger.info('Analytics data cleanup completed', {
        deletedAnalytics: analyticsCleanupResult.deletedAnalytics,
        deletedAIMetrics: analyticsCleanupResult.deletedAIMetrics
      });
    } else {
      logger.warn('Analytics data cleanup failed', {
        error: analyticsCleanupResult.error
      });
    }
    
    // Log report summary
    logger.info('Daily system check completed', {
      userCount: metrics.database.users,
      messageCount: metrics.database.messages
    });
    
    // Return success
    return {
      success: true,
      metrics,
      analyticsCleanup: analyticsCleanupResult
    };
  } catch (error) {
    logger.error('Error running daily system check', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format bytes to human-readable string
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

// Run the check if this script is executed directly
if (require.main === module) {
  runDailySystemCheck()
    .then(result => {
      if (result.success) {
        console.log('Daily system check completed successfully');
        process.exit(0);
      } else {
        console.error(`Daily system check failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error in daily system check:', error);
      process.exit(1);
    });
}

module.exports = {
  runDailySystemCheck
};
