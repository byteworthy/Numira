/**
 * Database Backup Script
 * 
 * This script creates a backup of the PostgreSQL database and stores it in the backups directory.
 * It can be run manually or scheduled via cron.
 * 
 * Usage: node cron/backup.js
 */

const logger = require('../utils/logger');
const backupService = require('../services/backupService');

/**
 * Main backup function
 */
async function runBackup() {
  try {
    logger.info('Starting backup process');
    
    // Initialize backup service
    await backupService.initialize();
    
    // Run backup with system user ID for audit logging
    const result = await backupService.runBackup('system-cron');
    
    return result;
  } catch (error) {
    logger.error('Backup process failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the backup if this script is executed directly
if (require.main === module) {
  runBackup()
    .then(result => {
      if (result.success) {
        console.log('Backup completed successfully');
        if (result.database && result.database.backupFile) {
          console.log(`Database backup: ${result.database.backupFile}`);
        }
        process.exit(0);
      } else {
        console.error('Backup failed:', result.error || 'Unknown error');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error in backup process:', error);
      process.exit(1);
    });
}

module.exports = {
  runBackup
};
