const Queue = require('bull');
const path = require('path');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const config = require('../config/config');
const logger = require('../utils/logger');

// Check if Redis is available
let redisAvailable = true;
let emailQueue, reportQueue, cleanupQueue, notificationQueue;

// Function to test Redis connection
const testRedisConnection = async () => {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      connectTimeout: 5000, // Short timeout for quick failure
      lazyConnect: true
    });
    
    await redis.connect();
    await redis.quit();
    return true;
  } catch (error) {
    logger.warn('Redis connection failed, queue services will be disabled', {
      error: error.message,
      host: config.redis.host,
      port: config.redis.port
    });
    return false;
  }
};

// Initialize queues if Redis is available
const initializeQueues = async () => {
  // Only check Redis in development mode
  if (config.server.env === 'development') {
    redisAvailable = await testRedisConnection();
  }
  
  if (!redisAvailable) {
    logger.info('Running without Redis in development mode - queue functionality disabled');
    return;
  }
  
  try {
    // Create queue instances
    emailQueue = new Queue('email-queue', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    reportQueue = new Queue('report-queue', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    cleanupQueue = new Queue('cleanup-queue', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    notificationQueue = new Queue('notification-queue', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
    
    logger.info('Queue services initialized successfully');
  } catch (error) {
    redisAvailable = false;
    logger.error('Failed to initialize queue services', { error: error.message });
  }
};

// Setup Bull Board UI
const setupBullBoard = (app) => {
  if (!redisAvailable) {
    // Skip Bull Board setup if Redis is not available
    return;
  }
  
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullAdapter(emailQueue),
        new BullAdapter(reportQueue),
        new BullAdapter(cleanupQueue),
        new BullAdapter(notificationQueue)
      ],
      serverAdapter
    });

    app.use('/admin/queues', serverAdapter.getRouter());
  } catch (error) {
    logger.error('Failed to setup Bull Board', { error: error.message });
  }
};

// Initialize processors
const initProcessors = () => {
  if (!redisAvailable) {
    // Skip processor initialization if Redis is not available
    return;
  }
  
  try {
    emailQueue.process(path.join(__dirname, '../processors/emailProcessor.js'));
    reportQueue.process(path.join(__dirname, '../processors/reportProcessor.js'));
    cleanupQueue.process(path.join(__dirname, '../processors/cleanupProcessor.js'));
    notificationQueue.process(path.join(__dirname, '../processors/notificationProcessor.js'));
  } catch (error) {
    logger.error('Failed to initialize queue processors', { error: error.message });
  }
};

// Add jobs to queues
const addEmailJob = (data, options = {}) => {
  if (!redisAvailable) {
    logger.debug('Email job skipped - Redis not available', { data });
    return Promise.resolve({ id: 'mock-id', skipped: true });
  }
  return emailQueue.add(data, options);
};

const addReportJob = (data, options = {}) => {
  if (!redisAvailable) {
    logger.debug('Report job skipped - Redis not available', { data });
    return Promise.resolve({ id: 'mock-id', skipped: true });
  }
  return reportQueue.add(data, options);
};

const addCleanupJob = (data, options = {}) => {
  if (!redisAvailable) {
    logger.debug('Cleanup job skipped - Redis not available', { data });
    return Promise.resolve({ id: 'mock-id', skipped: true });
  }
  return cleanupQueue.add(data, options);
};

const addNotificationJob = (data, options = {}) => {
  if (!redisAvailable) {
    logger.debug('Notification job skipped - Redis not available', { data });
    return Promise.resolve({ id: 'mock-id', skipped: true });
  }
  return notificationQueue.add(data, options);
};

// Schedule recurring jobs
const scheduleRecurringJobs = () => {
  if (!redisAvailable) {
    logger.info('Recurring jobs skipped - Redis not available');
    return;
  }
  
  try {
    // Daily cleanup job at 3 AM
    cleanupQueue.add(
      { type: 'daily-cleanup' },
      { 
        repeat: { 
          cron: '0 3 * * *',
          tz: 'America/New_York'
        }
      }
    );

    // Weekly report generation on Sundays at 1 AM
    reportQueue.add(
      { type: 'weekly-report' },
      { 
        repeat: { 
          cron: '0 1 * * 0',
          tz: 'America/New_York'
        }
      }
    );
    
    logger.info('Recurring jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule recurring jobs', { error: error.message });
  }
};

// Event listeners for monitoring
const setupQueueMonitoring = () => {
  if (!redisAvailable) {
    return;
  }
  
  try {
    const queues = [emailQueue, reportQueue, cleanupQueue, notificationQueue];

    queues.forEach(queue => {
      queue.on('error', (error) => {
        logger.error(`Queue error in ${queue.name}:`, error);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in ${queue.name}:`, error);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} stalled in ${queue.name}`);
      });
    });
  } catch (error) {
    logger.error('Failed to setup queue monitoring', { error: error.message });
  }
};

// Check if Redis is available
const isRedisAvailable = () => {
  return redisAvailable;
};

module.exports = {
  initializeQueues,
  isRedisAvailable,
  setupBullBoard,
  initProcessors,
  addEmailJob,
  addReportJob,
  addCleanupJob,
  addNotificationJob,
  scheduleRecurringJobs,
  setupQueueMonitoring
};
