const Queue = require('bull');
const path = require('path');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const config = require('../config/config');

// Create queue instances
const emailQueue = new Queue('email-queue', {
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

const reportQueue = new Queue('report-queue', {
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

const cleanupQueue = new Queue('cleanup-queue', {
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

const notificationQueue = new Queue('notification-queue', {
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

// Setup Bull Board UI
const setupBullBoard = (app) => {
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
};

// Initialize processors
const initProcessors = () => {
  emailQueue.process(path.join(__dirname, '../processors/emailProcessor.js'));
  reportQueue.process(path.join(__dirname, '../processors/reportProcessor.js'));
  cleanupQueue.process(path.join(__dirname, '../processors/cleanupProcessor.js'));
  notificationQueue.process(path.join(__dirname, '../processors/notificationProcessor.js'));
};

// Add jobs to queues
const addEmailJob = (data, options = {}) => {
  return emailQueue.add(data, options);
};

const addReportJob = (data, options = {}) => {
  return reportQueue.add(data, options);
};

const addCleanupJob = (data, options = {}) => {
  return cleanupQueue.add(data, options);
};

const addNotificationJob = (data, options = {}) => {
  return notificationQueue.add(data, options);
};

// Schedule recurring jobs
const scheduleRecurringJobs = () => {
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
};

// Event listeners for monitoring
const setupQueueMonitoring = () => {
  const queues = [emailQueue, reportQueue, cleanupQueue, notificationQueue];
  const logger = require('../utils/logger');

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
};

module.exports = {
  emailQueue,
  reportQueue,
  cleanupQueue,
  notificationQueue,
  setupBullBoard,
  initProcessors,
  addEmailJob,
  addReportJob,
  addCleanupJob,
  addNotificationJob,
  scheduleRecurringJobs,
  setupQueueMonitoring
};
