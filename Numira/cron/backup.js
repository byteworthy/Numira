/**
 * Database Backup Script
 * 
 * This script creates a backup of the PostgreSQL database and stores it in the backups directory.
 * It can be run manually or scheduled via cron.
 * 
 * Usage: node cron/backup.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../utils/logger');
const config = require('../config/config');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const zlib = require('zlib');
const { pipeline } = require('stream');
const pipelinePromise = promisify(pipeline);

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Create a timestamped filename for the backup
 * 
 * @returns {string} Backup filename
 */
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  return `numira_backup_${timestamp}.sql`;
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true });
      logger.info(`Created backup directory: ${BACKUP_DIR}`);
    }
  } catch (error) {
    logger.error('Failed to create backup directory', { error: error.message });
    throw error;
  }
}

/**
 * Create a database backup using pg_dump
 */
async function createDatabaseBackup() {
  try {
    // Ensure backup directory exists
    await ensureBackupDir();
    
    // Parse database URL to extract credentials
    const dbUrl = new URL(config.database.url);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.substring(1); // Remove leading slash
    const username = dbUrl.username;
    const password = dbUrl.password;
    
    // Create backup filename
    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const compressedPath = `${backupPath}.gz`;
    
    // Set environment variables for pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: password
    };
    
    // Build pg_dump command
    const pgDumpCmd = `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F p`;
    
    logger.info('Starting database backup', { database, backupPath });
    
    // Execute pg_dump and pipe to file
    const dumpProcess = exec(pgDumpCmd, { env });
    
    // Create write stream for the backup file
    const writeStream = fs.createWriteStream(backupPath);
    
    // Pipe pg_dump output to file
    dumpProcess.stdout.pipe(writeStream);
    
    // Handle completion
    await new Promise((resolve, reject) => {
      dumpProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });
      
      dumpProcess.on('error', reject);
    });
    
    // Compress the backup file
    const gzip = zlib.createGzip();
    const source = fs.createReadStream(backupPath);
    const destination = fs.createWriteStream(compressedPath);
    
    await pipelinePromise(source, gzip, destination);
    
    // Remove the uncompressed file
    fs.unlinkSync(backupPath);
    
    // Get file size
    const stats = fs.statSync(compressedPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    logger.info('Database backup completed successfully', {
      backupFile: compressedPath,
      sizeInMB: fileSizeMB
    });
    
    return {
      success: true,
      backupFile: compressedPath,
      sizeInMB: fileSizeMB
    };
  } catch (error) {
    logger.error('Database backup failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up old backups
 * 
 * @param {number} retentionDays - Number of days to keep backups
 */
async function cleanupOldBackups(retentionDays = 30) {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }
    
    logger.info(`Cleaning up backups older than ${retentionDays} days`);
    
    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    
    // Check each file
    for (const file of files) {
      if (!file.endsWith('.sql.gz')) continue;
      
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      
      // Delete if older than retention period
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    logger.info(`Deleted ${deletedCount} old backup files`);
    
    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    logger.error('Backup cleanup failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main backup function
 */
async function runBackup() {
  try {
    logger.info('Starting database backup process');
    
    // Create backup
    const backupResult = await createDatabaseBackup();
    
    // Clean up old backups
    const cleanupResult = await cleanupOldBackups();
    
    return {
      backup: backupResult,
      cleanup: cleanupResult
    };
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
      if (result.backup && result.backup.success) {
        console.log(`Backup completed successfully: ${result.backup.backupFile}`);
        process.exit(0);
      } else {
        console.error('Backup failed:', result.backup ? result.backup.error : 'Unknown error');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error in backup process:', error);
      process.exit(1);
    });
}

module.exports = {
  runBackup,
  createDatabaseBackup,
  cleanupOldBackups
};
