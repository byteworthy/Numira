const Queue = require('bull');
const path = require('path');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const config = require('../config/config');
const logger = require('../utils/logger');
const { checkRedisConnection, createRedisClient } = require('../utils/checkRedis');

// Check if Redis is available
let redisAvailable = false;
let emailQueue, reportQueue, cleanupQueue, notificationQueue;

// In-memory queue stub for fallback when Redis is unavailable
class InMemoryQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.processors = {};
    this.events = {};
    logger.info(`Created in-memory queue stub for ${name}`);
  }

  // Add a job to the queue
  add(data, options = {}) {
    const id = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const job = { id, data, options };
    this.jobs.push(job);
    logger.debug(`Added job to in-memory queue ${this.name}`, { id, data });
    
    // Process the job immediately if there's a processor
    if (this.processors.default) {
      setTimeout(() => {
        try {
          this.processors.default(job);
        } catch (error) {
          logger.error(`Error processing job in in-memory queue ${this.name}`, { error: error.message });
        }
      }, 10);
    }
    
    return Promise.resolve(job);
  }

  // Register a processor function
  process(processor) {
    if (typeof processor === 'string') {
      this.processors.default = () => {
        logger.debug(`Mock processing job from ${this.name} with external processor: ${processor}`);
      };
    } else {
      this.processors.default = processor;
    }
    return this;
  }

  // Register an event handler
  on(event, handler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    return this;
  }

  // Mock client for compatibility
  get client() {
    return {
      on: (event, handler) => {
        logger.debug(`Registered mock client event handler for ${event} on ${this.name}`);
      }
    };
  }
}

// Initialize queues with Redis or fallback to in-memory
const initializeQueues = async () => {
  // Check Redis connection
  redisAvailable = await checkRedisConnection();
  
  if (!redisAvailable) {
    logger.info('Redis unavailable - using in-memory queue stubs for Replit compatibility');
    
    // Create in-memory queue stubs
    emailQueue = new InMemoryQueue('email-queue');
    reportQueue = new InMemoryQueue('report-queue');
    cleanupQueue = new InMemoryQueue('cleanup-queue');
    notificationQueue = new InMemoryQueue('notification-queue');
    
    console.log('Queue fallback active: Using in-memory queue system for Replit compatibility');
    return;
  }
  
  try {
    // Create Redis client for queues
    const redisClient = createRedisClient();
    
    if (!redisClient) {
      throw new Error('Failed to create Redis client');
    }
    
    // Create queue instances with the client
    const queueOptions = {
      createClient: () => redisClient,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false
      }
    };
    
    // Create queue instances
    emailQueue = new Queue('email-queue', queueOptions);
    emailQueue.client.on('error', () => {}); // Suppress noisy reconnect errors

    reportQueue = new Queue('report-queue', queueOptions);
    reportQueue.client.on('error', () => {}); // Suppress noisy reconnect errors

    cleanupQueue = new Queue('cleanup-queue', queueOptions);
    cleanupQueue.client.on('error', () => {}); // Suppress noisy reconnect errors

    notificationQueue = new Queue('notification-queue', queueOptions);
    notificationQueue.client.on('error', () => {}); // Suppress noisy reconnect errors
    
    logger.info('Queue services initialized successfully with Redis');
  } catch (error) {
    redisAvailable = false;
    logger.error('Failed to initialize queue services with Redis', { error: error.message });
    
    // Fallback to in-memory queue stubs
    emailQueue = new InMemoryQueue('email-queue');
    reportQueue = new InMemoryQueue('report-queue');
    cleanupQueue = new InMemoryQueue('cleanup-queue');
    notificationQueue = new InMemoryQueue('notification-queue');
    
    logger.info('Falling back to in-memory queue stubs');
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
