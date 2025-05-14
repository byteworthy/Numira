/**
 * Backup Audit Logger
 * 
 * Provides specialized audit logging for backup and restore operations.
 * This is designed to meet HIPAA compliance requirements for audit trails.
 * 
 * Features:
 * - Detailed logging of all backup and restore operations
 * - User attribution for all operations
 * - Tamper-evident logging (with hash chains)
 * - Secure storage of audit logs
 * - Log rotation and retention policies
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const logger = require('./logger');

// Constants
const AUDIT_LOG_DIR = path.join(__dirname, '../logs/audit');
const BACKUP_AUDIT_LOG = path.join(AUDIT_LOG_DIR, 'backup-audit.log');
const RESTORE_AUDIT_LOG = path.join(AUDIT_LOG_DIR, 'restore-audit.log');
const ACCESS_AUDIT_LOG = path.join(AUDIT_LOG_DIR, 'backup-access.log');
const MAX_LOG_SIZE_MB = 10; // Rotate logs when they reach this size
const LOG_RETENTION_DAYS = 2555; // ~7 years (HIPAA requirement)

// Hash of the previous log entry (for tamper evidence)
let previousHash = '';

/**
 * Initialize the audit logger
 */
async function initialize() {
  try {
    // Create audit log directory if it doesn't exist
    if (!fs.existsSync(AUDIT_LOG_DIR)) {
      await mkdir(AUDIT_LOG_DIR, { recursive: true });
    }
    
    // Initialize log files if they don't exist
    for (const logFile of [BACKUP_AUDIT_LOG, RESTORE_AUDIT_LOG, ACCESS_AUDIT_LOG]) {
      if (!fs.existsSync(logFile)) {
        const initialEntry = createLogEntry({
          event: 'AUDIT_LOG_INITIALIZED',
          details: 'Audit logging system initialized'
        });
        await writeFile(logFile, initialEntry + '\n');
      }
    }
    
    // Load the hash of the last entry in each log file
    await loadPreviousHash();
    
    logger.info('Backup audit logger initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize backup audit logger', { error: error.message });
    return false;
  }
}

/**
 * Load the hash of the last entry in the log files
 */
async function loadPreviousHash() {
  try {
    // Read the last line of each log file to get the previous hash
    for (const logFile of [BACKUP_AUDIT_LOG, RESTORE_AUDIT_LOG, ACCESS_AUDIT_LOG]) {
      if (fs.existsSync(logFile)) {
        const content = await readFile(logFile, 'utf8');
        const lines = content.trim().split('\n');
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const lastEntry = JSON.parse(lastLine);
          previousHash = lastEntry.hash || '';
        }
      }
    }
  } catch (error) {
    logger.error('Failed to load previous hash', { error: error.message });
  }
}

/**
 * Create a log entry with a hash chain for tamper evidence
 * 
 * @param {Object} data - Data to log
 * @returns {string} JSON string of the log entry
 */
function createLogEntry(data) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    ...data,
    previousHash
  };
  
  // Calculate hash of this entry (includes the previous hash)
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(entry))
    .digest('hex');
  
  // Add hash to the entry
  entry.hash = hash;
  
  // Update previous hash for next entry
  previousHash = hash;
  
  return JSON.stringify(entry);
}

/**
 * Log a backup operation
 * 
 * @param {Object} data - Backup operation data
 * @param {string} data.type - Type of backup (database, files, etc.)
 * @param {string} data.path - Path to the backup file
 * @param {string} data.userId - ID of the user who initiated the backup
 * @param {Object} data.metadata - Additional metadata about the backup
 */
async function logBackupOperation(data) {
  try {
    // Check if log rotation is needed
    await checkLogRotation(BACKUP_AUDIT_LOG);
    
    // Create log entry
    const entry = createLogEntry({
      event: 'BACKUP_CREATED',
      ...data
    });
    
    // Append to log file
    await appendFile(BACKUP_AUDIT_LOG, entry + '\n');
    
    // Also log to regular logger for monitoring
    logger.info('Backup operation logged', { 
      type: data.type, 
      path: data.path,
      userId: data.userId
    });
  } catch (error) {
    logger.error('Failed to log backup operation', { error: error.message });
  }
}

/**
 * Log a restore operation
 * 
 * @param {Object} data - Restore operation data
 * @param {string} data.backupFile - Path to the backup file being restored
 * @param {string} data.userId - ID of the user who initiated the restore
 * @param {Object} data.metadata - Additional metadata about the restore
 */
async function logRestoreOperation(data) {
  try {
    // Check if log rotation is needed
    await checkLogRotation(RESTORE_AUDIT_LOG);
    
    // Create log entry
    const entry = createLogEntry({
      event: 'BACKUP_RESTORED',
      ...data
    });
    
    // Append to log file
    await appendFile(RESTORE_AUDIT_LOG, entry + '\n');
    
    // Also log to regular logger for monitoring
    logger.info('Restore operation logged', { 
      backupFile: data.backupFile, 
      userId: data.userId
    });
  } catch (error) {
    logger.error('Failed to log restore operation', { error: error.message });
  }
}

/**
 * Log backup access (viewing, downloading, etc.)
 * 
 * @param {Object} data - Access data
 * @param {string} data.backupFile - Path to the backup file being accessed
 * @param {string} data.userId - ID of the user accessing the backup
 * @param {string} data.action - Type of access (view, download, etc.)
 * @param {Object} data.metadata - Additional metadata about the access
 */
async function logBackupAccess(data) {
  try {
    // Check if log rotation is needed
    await checkLogRotation(ACCESS_AUDIT_LOG);
    
    // Create log entry
    const entry = createLogEntry({
      event: 'BACKUP_ACCESSED',
      ...data
    });
    
    // Append to log file
    await appendFile(ACCESS_AUDIT_LOG, entry + '\n');
    
    // Also log to regular logger for monitoring
    logger.info('Backup access logged', { 
      backupFile: data.backupFile, 
      userId: data.userId,
      action: data.action
    });
  } catch (error) {
    logger.error('Failed to log backup access', { error: error.message });
  }
}

/**
 * Check if log rotation is needed and rotate if necessary
 * 
 * @param {string} logFile - Path to the log file to check
 */
async function checkLogRotation(logFile) {
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB >= MAX_LOG_SIZE_MB) {
        // Rotate the log file
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const rotatedFile = `${logFile}.${timestamp}`;
        
        // Rename current log file
        fs.renameSync(logFile, rotatedFile);
        
        // Create a new log file
        const initialEntry = createLogEntry({
          event: 'LOG_ROTATED',
          previousLogFile: rotatedFile
        });
        await writeFile(logFile, initialEntry + '\n');
        
        logger.info(`Log file rotated: ${logFile} -> ${rotatedFile}`);
        
        // Clean up old log files
        await cleanupOldLogs(path.dirname(logFile));
      }
    }
  } catch (error) {
    logger.error('Failed to check/rotate log file', { error: error.message });
  }
}

/**
 * Clean up old log files based on retention policy
 * 
 * @param {string} logDir - Directory containing log files
 */
async function cleanupOldLogs(logDir) {
  try {
    const files = fs.readdirSync(logDir);
    const now = new Date();
    
    for (const file of files) {
      // Only process rotated log files
      if (!file.includes('.20')) continue;
      
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      // Calculate file age in days
      const fileAge = (now - stats.mtime) / (1000 * 60 * 60 * 24);
      
      // Delete if older than retention period
      if (fileAge > LOG_RETENTION_DAYS) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old log file: ${filePath}`);
      }
    }
  } catch (error) {
    logger.error('Failed to clean up old log files', { error: error.message });
  }
}

/**
 * Verify the integrity of the audit logs
 * 
 * @returns {Promise<Object>} Verification result
 */
async function verifyLogIntegrity() {
  const results = {};
  
  for (const logFile of [BACKUP_AUDIT_LOG, RESTORE_AUDIT_LOG, ACCESS_AUDIT_LOG]) {
    try {
      if (!fs.existsSync(logFile)) {
        results[path.basename(logFile)] = {
          verified: false,
          error: 'Log file does not exist'
        };
        continue;
      }
      
      const content = await readFile(logFile, 'utf8');
      const lines = content.trim().split('\n');
      
      let previousHash = '';
      let valid = true;
      let invalidEntries = [];
      
      for (let i = 0; i < lines.length; i++) {
        const entry = JSON.parse(lines[i]);
        
        // Skip hash verification for the first entry
        if (i === 0) {
          previousHash = entry.hash;
          continue;
        }
        
        // Verify that this entry's previousHash matches the hash of the previous entry
        if (entry.previousHash !== previousHash) {
          valid = false;
          invalidEntries.push(i);
        }
        
        // Verify the hash of this entry
        const entryWithoutHash = { ...entry };
        delete entryWithoutHash.hash;
        
        const calculatedHash = crypto.createHash('sha256')
          .update(JSON.stringify(entryWithoutHash))
          .digest('hex');
        
        if (calculatedHash !== entry.hash) {
          valid = false;
          invalidEntries.push(i);
        }
        
        previousHash = entry.hash;
      }
      
      results[path.basename(logFile)] = {
        verified: valid,
        entries: lines.length,
        invalidEntries: invalidEntries.length > 0 ? invalidEntries : undefined
      };
    } catch (error) {
      results[path.basename(logFile)] = {
        verified: false,
        error: error.message
      };
    }
  }
  
  return results;
}

module.exports = {
  initialize,
  logBackupOperation,
  logRestoreOperation,
  logBackupAccess,
  verifyLogIntegrity
};
