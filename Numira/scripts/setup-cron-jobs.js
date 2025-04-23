const cron = require('node-cron');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../utils/logger');

/**
 * Setup cron jobs for the application
 */
function setupCronJobs() {
  logger.info('Setting up cron jobs');

  // Daily backup at 2 AM
  cron.schedule('0 2 * * *', () => {
    logger.info('Running daily backup');
    const backupProcess = spawn('node', [path.join(__dirname, '../cron/backup.js')]);
    
    backupProcess.stdout.on('data', (data) => {
      logger.info(`Backup: ${data}`);
    });
    
    backupProcess.stderr.on('data', (data) => {
      logger.error(`Backup error: ${data}`);
    });
    
    backupProcess.on('close', (code) => {
      logger.info(`Backup process exited with code ${code}`);
    });
  });

  // Weekly cleanup at 3 AM on Sunday
  cron.schedule('0 3 * * 0', () => {
    logger.info('Running weekly cleanup');
    const cleanupProcess = spawn('node', [path.join(__dirname, '../cron/cleanup.js')]);
    
    cleanupProcess.stdout.on('data', (data) => {
      logger.info(`Cleanup: ${data}`);
    });
    
    cleanupProcess.stderr.on('data', (data) => {
      logger.error(`Cleanup error: ${data}`);
    });
    
    cleanupProcess.on('close', (code) => {
      logger.info(`Cleanup process exited with code ${code}`);
    });
  });

  // Daily system check at 4 AM
  if (process.env.DAILY_SYSTEM_CHECK_ENABLED === 'true') {
    cron.schedule('0 4 * * *', () => {
      logger.info('Running daily system check');
      const systemCheckProcess = spawn('node', [path.join(__dirname, '../cron/daily-system-check.js')]);
      
      systemCheckProcess.stdout.on('data', (data) => {
        logger.info(`System check: ${data}`);
      });
      
      systemCheckProcess.stderr.on('data', (data) => {
        logger.error(`System check error: ${data}`);
      });
      
      systemCheckProcess.on('close', (code) => {
        logger.info(`System check process exited with code ${code}`);
      });
    });
    logger.info('Daily system check scheduled');
  }

  logger.info('Cron jobs setup complete');
}

module.exports = setupCronJobs;
