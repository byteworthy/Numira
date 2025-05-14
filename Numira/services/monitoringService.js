/**
 * Monitoring Service
 * 
 * Provides comprehensive application monitoring capabilities:
 * - System metrics collection (CPU, memory, disk usage)
 * - Application health metrics (response times, error rates)
 * - Custom business metrics (active users, API usage)
 * - Alerting for critical issues
 * - Integration with external monitoring services
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');
const { EventEmitter } = require('events');

// Create a metrics event emitter for real-time monitoring
const metricsEmitter = new EventEmitter();

// In-memory storage for metrics (for short-term tracking)
const metricsStore = {
  // System metrics
  system: {
    cpu: [],
    memory: [],
    disk: [],
    uptime: []
  },
  
  // Application metrics
  application: {
    requestCount: 0,
    errorCount: 0,
    responseTime: [],
    activeUsers: new Set(),
    apiCalls: {},
    aiRequests: 0,
    databaseQueries: 0
  },
  
  // Custom business metrics
  business: {
    newUsers: 0,
    conversations: 0,
    journalEntries: 0,
    personaUsage: {},
    roomUsage: {}
  },
  
  // Alert history
  alerts: []
};

// Alert thresholds (these could be moved to config)
const alertThresholds = {
  system: {
    cpuUsage: 80, // percentage
    memoryUsage: 85, // percentage
    diskUsage: 90, // percentage
  },
  application: {
    errorRate: 5, // percentage
    responseTime: 2000, // milliseconds
    consecutiveErrors: 5
  }
};

// Track consecutive errors for alerting
let consecutiveErrors = 0;

/**
 * Initialize the monitoring service
 */
async function initialize() {
  try {
    logger.info('Initializing monitoring service');
    
    // Create metrics directory if it doesn't exist
    const metricsDir = path.join(__dirname, '../metrics');
    try {
      await fs.mkdir(metricsDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating metrics directory', { error: error.message });
    }
    
    // Start collecting system metrics
    startSystemMetricsCollection();
    
    // Set up periodic metrics persistence
    startMetricsPersistence();
    
    // Set up alert checking
    startAlertChecking();
    
    logger.info('Monitoring service initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize monitoring service', { error: error.message });
    return false;
  }
}

/**
 * Start collecting system metrics at regular intervals
 */
function startSystemMetricsCollection() {
  const interval = config.monitoring?.systemMetricsInterval || 60000; // Default: 1 minute
  
  setInterval(async () => {
    try {
      // Collect CPU metrics
      const cpuUsage = await getCpuUsage();
      metricsStore.system.cpu.push({
        timestamp: Date.now(),
        value: cpuUsage
      });
      
      // Trim array to keep only recent data
      if (metricsStore.system.cpu.length > 60) {
        metricsStore.system.cpu.shift();
      }
      
      // Collect memory metrics
      const memUsage = getMemoryUsage();
      metricsStore.system.memory.push({
        timestamp: Date.now(),
        value: memUsage
      });
      
      // Trim array to keep only recent data
      if (metricsStore.system.memory.length > 60) {
        metricsStore.system.memory.shift();
      }
      
      // Collect disk metrics
      const diskUsage = await getDiskUsage();
      metricsStore.system.disk.push({
        timestamp: Date.now(),
        value: diskUsage
      });
      
      // Trim array to keep only recent data
      if (metricsStore.system.disk.length > 60) {
        metricsStore.system.disk.shift();
      }
      
      // Collect uptime
      metricsStore.system.uptime.push({
        timestamp: Date.now(),
        value: os.uptime()
      });
      
      // Trim array to keep only recent data
      if (metricsStore.system.uptime.length > 60) {
        metricsStore.system.uptime.shift();
      }
      
      // Emit metrics event for real-time monitoring
      metricsEmitter.emit('system-metrics', {
        cpu: cpuUsage,
        memory: memUsage,
        disk: diskUsage,
        uptime: os.uptime()
      });
      
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
    }
  }, interval);
}

/**
 * Start persisting metrics to disk at regular intervals
 */
function startMetricsPersistence() {
  const interval = config.monitoring?.metricsPersistenceInterval || 300000; // Default: 5 minutes
  
  setInterval(async () => {
    try {
      // Create a snapshot of current metrics
      const snapshot = {
        timestamp: Date.now(),
        system: {
          cpu: metricsStore.system.cpu.length > 0 ? metricsStore.system.cpu[metricsStore.system.cpu.length - 1].value : null,
          memory: metricsStore.system.memory.length > 0 ? metricsStore.system.memory[metricsStore.system.memory.length - 1].value : null,
          disk: metricsStore.system.disk.length > 0 ? metricsStore.system.disk[metricsStore.system.disk.length - 1].value : null,
          uptime: os.uptime()
        },
        application: {
          requestCount: metricsStore.application.requestCount,
          errorCount: metricsStore.application.errorCount,
          responseTime: calculateAverageResponseTime(),
          activeUsers: metricsStore.application.activeUsers.size,
          apiCalls: metricsStore.application.apiCalls,
          aiRequests: metricsStore.application.aiRequests,
          databaseQueries: metricsStore.application.databaseQueries
        },
        business: {
          newUsers: metricsStore.business.newUsers,
          conversations: metricsStore.business.conversations,
          journalEntries: metricsStore.business.journalEntries,
          personaUsage: metricsStore.business.personaUsage,
          roomUsage: metricsStore.business.roomUsage
        }
      };
      
      // Write snapshot to file
      const filename = path.join(__dirname, '../metrics', `metrics-${new Date().toISOString().split('T')[0]}.json`);
      
      // Read existing file if it exists
      let existingData = [];
      try {
        const fileContent = await fs.readFile(filename, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
        existingData = [];
      }
      
      // Add new snapshot
      existingData.push(snapshot);
      
      // Write updated data
      await fs.writeFile(filename, JSON.stringify(existingData, null, 2), 'utf8');
      
      logger.debug('Metrics persisted to disk');
      
      // Reset some counters after persistence
      resetCounters();
      
    } catch (error) {
      logger.error('Error persisting metrics', { error: error.message });
    }
  }, interval);
}

/**
 * Start checking for alert conditions at regular intervals
 */
function startAlertChecking() {
  const interval = config.monitoring?.alertCheckInterval || 60000; // Default: 1 minute
  
  setInterval(() => {
    try {
      checkSystemAlerts();
      checkApplicationAlerts();
    } catch (error) {
      logger.error('Error checking alerts', { error: error.message });
    }
  }, interval);
}

/**
 * Check system metrics for alert conditions
 */
function checkSystemAlerts() {
  // Check CPU usage
  if (metricsStore.system.cpu.length > 0) {
    const latestCpu = metricsStore.system.cpu[metricsStore.system.cpu.length - 1].value;
    if (latestCpu > alertThresholds.system.cpuUsage) {
      triggerAlert('system', 'High CPU Usage', `CPU usage at ${latestCpu.toFixed(2)}%`, 'warning');
    }
  }
  
  // Check memory usage
  if (metricsStore.system.memory.length > 0) {
    const latestMemory = metricsStore.system.memory[metricsStore.system.memory.length - 1].value;
    if (latestMemory > alertThresholds.system.memoryUsage) {
      triggerAlert('system', 'High Memory Usage', `Memory usage at ${latestMemory.toFixed(2)}%`, 'warning');
    }
  }
  
  // Check disk usage
  if (metricsStore.system.disk.length > 0) {
    const latestDisk = metricsStore.system.disk[metricsStore.system.disk.length - 1].value;
    if (latestDisk > alertThresholds.system.diskUsage) {
      triggerAlert('system', 'High Disk Usage', `Disk usage at ${latestDisk.toFixed(2)}%`, 'warning');
    }
  }
}

/**
 * Check application metrics for alert conditions
 */
function checkApplicationAlerts() {
  // Check error rate
  const totalRequests = metricsStore.application.requestCount;
  if (totalRequests > 0) {
    const errorRate = (metricsStore.application.errorCount / totalRequests) * 100;
    if (errorRate > alertThresholds.application.errorRate) {
      triggerAlert('application', 'High Error Rate', `Error rate at ${errorRate.toFixed(2)}%`, 'error');
    }
  }
  
  // Check average response time
  const avgResponseTime = calculateAverageResponseTime();
  if (avgResponseTime > alertThresholds.application.responseTime) {
    triggerAlert('application', 'High Response Time', `Average response time at ${avgResponseTime.toFixed(2)}ms`, 'warning');
  }
}

/**
 * Trigger an alert
 * 
 * @param {string} category - Alert category (system, application, business)
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {string} severity - Alert severity (info, warning, error, critical)
 */
function triggerAlert(category, title, message, severity) {
  const alert = {
    timestamp: Date.now(),
    category,
    title,
    message,
    severity
  };
  
  // Add to alert history
  metricsStore.alerts.push(alert);
  
  // Trim alert history to keep only recent alerts
  if (metricsStore.alerts.length > 100) {
    metricsStore.alerts.shift();
  }
  
  // Log the alert
  logger[severity === 'critical' ? 'error' : severity]({
    message: `ALERT: ${title} - ${message}`,
    category,
    severity
  });
  
  // Emit alert event for real-time monitoring
  metricsEmitter.emit('alert', alert);
  
  // For critical alerts, we might want to send notifications
  if (severity === 'critical' || severity === 'error') {
    // This could integrate with notification services
    // For now, we'll just log it
    logger.error(`CRITICAL ALERT: ${title} - ${message}`);
  }
}

/**
 * Track a request for monitoring
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} startTime - Request start time (milliseconds)
 */
function trackRequest(req, res, startTime) {
  // Increment request count
  metricsStore.application.requestCount++;
  
  // Calculate response time
  const responseTime = Date.now() - startTime;
  
  // Add to response time array
  metricsStore.application.responseTime.push(responseTime);
  
  // Trim array to keep only recent data
  if (metricsStore.application.responseTime.length > 1000) {
    metricsStore.application.responseTime.shift();
  }
  
  // Track API endpoint usage
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  metricsStore.application.apiCalls[endpoint] = (metricsStore.application.apiCalls[endpoint] || 0) + 1;
  
  // Track user activity if authenticated
  if (req.user?.id) {
    metricsStore.application.activeUsers.add(req.user.id);
  }
  
  // Track errors
  if (res.statusCode >= 400) {
    metricsStore.application.errorCount++;
    consecutiveErrors++;
    
    // Check for consecutive errors alert
    if (consecutiveErrors >= alertThresholds.application.consecutiveErrors) {
      triggerAlert(
        'application',
        'Consecutive Errors',
        `${consecutiveErrors} consecutive errors detected`,
        'error'
      );
    }
  } else {
    // Reset consecutive errors counter on successful request
    consecutiveErrors = 0;
  }
  
  // Emit request metrics event
  metricsEmitter.emit('request-metrics', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime,
    userId: req.user?.id
  });
}

/**
 * Track an AI request for monitoring
 * 
 * @param {string} userId - User ID
 * @param {string} personaId - Persona ID
 * @param {string} roomId - Room ID
 * @param {number} responseTime - Response time in milliseconds
 * @param {boolean} success - Whether the request was successful
 */
function trackAIRequest(userId, personaId, roomId, responseTime, success) {
  // Increment AI request count
  metricsStore.application.aiRequests++;
  
  // Track persona usage
  metricsStore.business.personaUsage[personaId] = (metricsStore.business.personaUsage[personaId] || 0) + 1;
  
  // Track room usage
  metricsStore.business.roomUsage[roomId] = (metricsStore.business.roomUsage[roomId] || 0) + 1;
  
  // Track conversation
  metricsStore.business.conversations++;
  
  // Add to response time array
  metricsStore.application.responseTime.push(responseTime);
  
  // Trim array to keep only recent data
  if (metricsStore.application.responseTime.length > 1000) {
    metricsStore.application.responseTime.shift();
  }
  
  // Track errors
  if (!success) {
    metricsStore.application.errorCount++;
  }
  
  // Emit AI metrics event
  metricsEmitter.emit('ai-metrics', {
    userId,
    personaId,
    roomId,
    responseTime,
    success
  });
}

/**
 * Track a database query for monitoring
 * 
 * @param {string} operation - Query operation (find, create, update, delete)
 * @param {string} model - Database model
 * @param {number} responseTime - Response time in milliseconds
 * @param {boolean} success - Whether the query was successful
 */
function trackDatabaseQuery(operation, model, responseTime, success) {
  // Increment database query count
  metricsStore.application.databaseQueries++;
  
  // Add to response time array
  metricsStore.application.responseTime.push(responseTime);
  
  // Trim array to keep only recent data
  if (metricsStore.application.responseTime.length > 1000) {
    metricsStore.application.responseTime.shift();
  }
  
  // Track errors
  if (!success) {
    metricsStore.application.errorCount++;
  }
  
  // Emit database metrics event
  metricsEmitter.emit('database-metrics', {
    operation,
    model,
    responseTime,
    success
  });
}

/**
 * Track a new user registration
 * 
 * @param {string} userId - User ID
 */
function trackNewUser(userId) {
  // Increment new user count
  metricsStore.business.newUsers++;
  
  // Add to active users
  metricsStore.application.activeUsers.add(userId);
  
  // Emit new user event
  metricsEmitter.emit('new-user', { userId });
}

/**
 * Track a new journal entry
 * 
 * @param {string} userId - User ID
 * @param {string} personaId - Persona ID
 * @param {string} roomId - Room ID
 */
function trackJournalEntry(userId, personaId, roomId) {
  // Increment journal entry count
  metricsStore.business.journalEntries++;
  
  // Track persona usage
  metricsStore.business.personaUsage[personaId] = (metricsStore.business.personaUsage[personaId] || 0) + 1;
  
  // Track room usage
  metricsStore.business.roomUsage[roomId] = (metricsStore.business.roomUsage[roomId] || 0) + 1;
  
  // Emit journal entry event
  metricsEmitter.emit('journal-entry', {
    userId,
    personaId,
    roomId
  });
}

/**
 * Get current CPU usage percentage
 * 
 * @returns {Promise<number>} CPU usage percentage
 */
async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = os.cpus().map(cpu => {
      return {
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
      };
    });
    
    // Wait a second for the next measurement
    setTimeout(() => {
      const endMeasure = os.cpus().map(cpu => {
        return {
          idle: cpu.times.idle,
          total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
        };
      });
      
      // Calculate CPU usage
      const cpuUsage = startMeasure.map((start, i) => {
        const end = endMeasure[i];
        const idleDiff = end.idle - start.idle;
        const totalDiff = end.total - start.total;
        const usagePercent = 100 - (100 * idleDiff / totalDiff);
        return usagePercent;
      });
      
      // Return average CPU usage across all cores
      const avgCpuUsage = cpuUsage.reduce((acc, usage) => acc + usage, 0) / cpuUsage.length;
      resolve(avgCpuUsage);
    }, 100);
  });
}

/**
 * Get current memory usage percentage
 * 
 * @returns {number} Memory usage percentage
 */
function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return (usedMem / totalMem) * 100;
}

/**
 * Get current disk usage percentage
 * 
 * @returns {Promise<number>} Disk usage percentage
 */
async function getDiskUsage() {
  try {
    // This is a simplified version that checks the application directory
    const stats = await fs.statfs(__dirname);
    const totalSpace = stats.blocks * stats.bsize;
    const freeSpace = stats.bfree * stats.bsize;
    const usedSpace = totalSpace - freeSpace;
    return (usedSpace / totalSpace) * 100;
  } catch (error) {
    logger.error('Error getting disk usage', { error: error.message });
    return 0;
  }
}

/**
 * Calculate average response time from stored metrics
 * 
 * @returns {number} Average response time in milliseconds
 */
function calculateAverageResponseTime() {
  if (metricsStore.application.responseTime.length === 0) {
    return 0;
  }
  
  const sum = metricsStore.application.responseTime.reduce((acc, time) => acc + time, 0);
  return sum / metricsStore.application.responseTime.length;
}

/**
 * Reset counters after metrics persistence
 */
function resetCounters() {
  // Reset request and error counts
  metricsStore.application.requestCount = 0;
  metricsStore.application.errorCount = 0;
  
  // Reset business metrics
  metricsStore.business.newUsers = 0;
  metricsStore.business.conversations = 0;
  metricsStore.business.journalEntries = 0;
  
  // Keep persona and room usage for longer-term tracking
}

/**
 * Get current metrics snapshot
 * 
 * @returns {Object} Current metrics
 */
function getMetrics() {
  return {
    timestamp: Date.now(),
    system: {
      cpu: metricsStore.system.cpu.length > 0 ? metricsStore.system.cpu[metricsStore.system.cpu.length - 1].value : null,
      memory: metricsStore.system.memory.length > 0 ? metricsStore.system.memory[metricsStore.system.memory.length - 1].value : null,
      disk: metricsStore.system.disk.length > 0 ? metricsStore.system.disk[metricsStore.system.disk.length - 1].value : null,
      uptime: os.uptime()
    },
    application: {
      requestCount: metricsStore.application.requestCount,
      errorCount: metricsStore.application.errorCount,
      errorRate: metricsStore.application.requestCount > 0 
        ? (metricsStore.application.errorCount / metricsStore.application.requestCount) * 100 
        : 0,
      responseTime: calculateAverageResponseTime(),
      activeUsers: metricsStore.application.activeUsers.size,
      apiCalls: metricsStore.application.apiCalls,
      aiRequests: metricsStore.application.aiRequests,
      databaseQueries: metricsStore.application.databaseQueries
    },
    business: {
      newUsers: metricsStore.business.newUsers,
      conversations: metricsStore.business.conversations,
      journalEntries: metricsStore.business.journalEntries,
      personaUsage: metricsStore.business.personaUsage,
      roomUsage: metricsStore.business.roomUsage
    }
  };
}

/**
 * Get recent alerts
 * 
 * @param {number} limit - Maximum number of alerts to return
 * @returns {Array} Recent alerts
 */
function getAlerts(limit = 10) {
  return metricsStore.alerts.slice(-limit);
}

/**
 * Subscribe to metrics events
 * 
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
function subscribe(event, callback) {
  metricsEmitter.on(event, callback);
  return () => metricsEmitter.off(event, callback); // Return unsubscribe function
}

module.exports = {
  initialize,
  trackRequest,
  trackAIRequest,
  trackDatabaseQuery,
  trackNewUser,
  trackJournalEntry,
  getMetrics,
  getAlerts,
  subscribe
};
