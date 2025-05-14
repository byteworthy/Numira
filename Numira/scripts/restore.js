/**
 * Database Restore Script
 * 
 * This script restores a PostgreSQL database from a backup file.
 * It can be run manually when needed.
 * 
 * Usage: node scripts/restore.js [backup-file]
 * Example: node scripts/restore.js backups/database/db_2025-04-23_14-30-00.sql.gz
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../utils/logger');
const config = require('../config/config');
const zlib = require('zlib');
const { pipeline } = require('stream');
const pipelinePromise = util.promisify(pipeline);
const readline = require('readline');
const backupService = require('../services/backupService');
const auditLogger = require('../utils/backupAuditLogger');

// Backup directories
const DB_BACKUP_DIR = path.join(__dirname, '../backups/database');

/**
 * List available database backups
 * 
 * @returns {Promise<Array>} Array of backup files with metadata
 */
async function listBackups() {
  try {
    // Initialize backup service
    await backupService.initialize();
    
    // Ensure backup directory exists
    if (!fs.existsSync(DB_BACKUP_DIR)) {
      console.log('No database backups directory found.');
      return [];
    }
    
    // Get all backup files
    const files = fs.readdirSync(DB_BACKUP_DIR)
      .filter(file => file.endsWith('.sql.gz'))
      .map(file => {
        const filePath = path.join(DB_BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          date: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
    
    return files;
  } catch (error) {
    console.error('Error listing backups:', error.message);
    return [];
  }
}

/**
 * Restore database from backup file
 * 
 * @param {string} backupFile - Path to backup file
 * @param {string} userId - ID of the user performing the restore (for audit logging)
 * @returns {Promise<Object>} Result of restore operation
 */
async function restoreDatabase(backupFile, userId = 'system-restore') {
  try {
    // Check if backup file exists
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    // Parse database URL to extract credentials
    const dbUrl = new URL(config.database.url);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.substring(1); // Remove leading slash
    const username = dbUrl.username;
    const password = dbUrl.password;
    
    // Set environment variables for psql
    const env = {
      ...process.env,
      PGPASSWORD: password
    };
    
    console.log(`Preparing to restore database ${database} from ${backupFile}`);
    console.log('WARNING: This will overwrite the current database. All existing data will be lost.');
    
    // Ask for confirmation
    const confirmed = await confirmRestore();
    if (!confirmed) {
      console.log('Restore cancelled.');
      return { success: false, message: 'Restore cancelled by user' };
    }
    
    // Create temporary uncompressed file
    const tempFile = path.join(path.dirname(backupFile), `temp_${path.basename(backupFile, '.gz')}`);
    
    console.log('Decompressing backup file...');
    
    // Decompress the backup file
    const gunzip = zlib.createGunzip();
    const source = fs.createReadStream(backupFile);
    const destination = fs.createWriteStream(tempFile);
    
    await pipelinePromise(source, gunzip, destination);
    
    console.log('Restoring database...');
    
    // Build psql command
    const psqlCmd = `psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${tempFile}"`;
    
    // Execute psql command
    const { stdout, stderr } = await execPromise(psqlCmd, { env });
    
    // Clean up temporary file
    fs.unlinkSync(tempFile);
    
    console.log('Database restore completed successfully.');
    
    // Log the restore operation to the audit log
    await auditLogger.logRestoreOperation({
      backupFile,
      userId,
      metadata: {
        database,
        timestamp: new Date().toISOString()
      }
    });
    
    return {
      success: true,
      message: 'Database restore completed successfully',
      details: {
        stdout,
        stderr
      }
    };
  } catch (error) {
    console.error('Database restore failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ask for confirmation before restoring
 * 
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
function confirmRestore() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question('Are you sure you want to restore the database? This will overwrite all existing data. (y/N): ', answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Initialize audit logger
    await auditLogger.initialize();
    
    // Check if backup file is provided as argument
    const backupFile = process.argv[2];
    
    if (backupFile) {
      // Resolve path if provided
      const resolvedPath = path.resolve(backupFile);
      await restoreDatabase(resolvedPath, 'system-cli');
    } else {
      // List available backups
      const backups = await listBackups();
      
      if (backups.length === 0) {
        console.log('No backup files found.');
        return;
      }
      
      console.log('Available backups:');
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.filename} (${backup.size}) - ${new Date(backup.date).toLocaleString()}`);
      });
      
      // Ask user to select a backup
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Enter the number of the backup to restore (or 0 to cancel): ', async answer => {
        rl.close();
        
        const selection = parseInt(answer, 10);
        
        if (isNaN(selection) || selection <= 0 || selection > backups.length) {
          console.log('Restore cancelled or invalid selection.');
          return;
        }
        
        const selectedBackup = backups[selection - 1];
        await restoreDatabase(selectedBackup.path, 'system-interactive');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  listBackups,
  restoreDatabase
};
