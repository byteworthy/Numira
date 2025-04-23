const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Process cleanup jobs
 * @param {Object} job - The job object containing data for the cleanup task
 * @returns {Promise} - Resolves when the cleanup is complete
 */
module.exports = async (job) => {
  const { data } = job;
  
  logger.info(`Processing cleanup job ${job.id}`, { 
    jobId: job.id,
    type: data.type
  });

  try {
    // Validate required fields
    if (!data.type) {
      throw new Error('Missing required cleanup field: type');
    }

    let result;
    
    // Perform different types of cleanup
    switch (data.type) {
      case 'temp-files':
        result = await cleanupTempFiles(data.olderThan, data.directory);
        break;
        
      case 'old-reports':
        result = await cleanupOldReports(data.olderThan);
        break;
        
      case 'expired-sessions':
        result = await cleanupExpiredSessions(data.olderThan);
        break;
        
      case 'daily-cleanup':
        result = await performDailyCleanup();
        break;
        
      case 'logs-rotation':
        result = await rotateLogFiles(data.maxSize, data.maxFiles);
        break;
        
      default:
        throw new Error(`Unknown cleanup type: ${data.type}`);
    }
    
    logger.info(`Cleanup completed successfully for job ${job.id}`, { 
      jobId: job.id,
      type: data.type,
      result
    });

    return result;
  } catch (error) {
    logger.error(`Error during cleanup for job ${job.id}`, { 
      jobId: job.id,
      error: error.message,
      stack: error.stack
    });
    
    // Rethrow the error to let Bull handle the retry logic
    throw error;
  }
};

/**
 * Clean up temporary files
 * @param {number} olderThan - Age in milliseconds to consider files old
 * @param {string} directory - Directory to clean up
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupTempFiles(olderThan = 24 * 60 * 60 * 1000, directory = '../temp') {
  const tempDir = path.resolve(__dirname, directory);
  
  // Check if directory exists
  if (!fs.existsSync(tempDir)) {
    logger.warn(`Temp directory does not exist: ${tempDir}`);
    return { deleted: 0, errors: 0 };
  }
  
  const now = Date.now();
  const cutoffTime = now - olderThan;
  let deleted = 0;
  let errors = 0;
  
  // Read directory contents
  const files = fs.readdirSync(tempDir);
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    
    try {
      const stats = fs.statSync(filePath);
      
      // Skip directories
      if (stats.isDirectory()) {
        continue;
      }
      
      // Check if file is older than cutoff
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deleted++;
        
        logger.debug(`Deleted temp file: ${filePath}`, {
          age: Math.round((now - stats.mtimeMs) / (60 * 60 * 1000)) + ' hours',
          size: stats.size
        });
      }
    } catch (error) {
      errors++;
      logger.error(`Error processing temp file ${filePath}`, {
        error: error.message
      });
    }
  }
  
  return { deleted, errors };
}

/**
 * Clean up old reports
 * @param {number} olderThan - Age in milliseconds to consider reports old
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupOldReports(olderThan = 30 * 24 * 60 * 60 * 1000) {
  const reportsDir = path.resolve(__dirname, '../reports');
  
  // Check if directory exists
  if (!fs.existsSync(reportsDir)) {
    logger.warn(`Reports directory does not exist: ${reportsDir}`);
    return { deleted: 0, errors: 0 };
  }
  
  const now = Date.now();
  const cutoffTime = now - olderThan;
  let deleted = 0;
  let errors = 0;
  
  // Read directory contents
  const files = fs.readdirSync(reportsDir);
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    
    try {
      const stats = fs.statSync(filePath);
      
      // Skip directories
      if (stats.isDirectory()) {
        continue;
      }
      
      // Check if file is older than cutoff
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deleted++;
        
        logger.debug(`Deleted old report: ${filePath}`, {
          age: Math.round((now - stats.mtimeMs) / (24 * 60 * 60 * 1000)) + ' days',
          size: stats.size
        });
      }
    } catch (error) {
      errors++;
      logger.error(`Error processing report file ${filePath}`, {
        error: error.message
      });
    }
  }
  
  return { deleted, errors };
}

/**
 * Clean up expired sessions
 * @param {number} olderThan - Age in milliseconds to consider sessions expired
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupExpiredSessions(olderThan = 7 * 24 * 60 * 60 * 1000) {
  // This would be implemented with actual database queries
  // For now, we'll return mock data
  logger.info(`Cleaning up sessions older than ${olderThan / (24 * 60 * 60 * 1000)} days`);
  
  // Mock implementation
  const deletedCount = Math.floor(Math.random() * 50);
  
  return {
    deleted: deletedCount,
    errors: 0
  };
}

/**
 * Perform daily cleanup tasks
 * @returns {Promise<Object>} - Cleanup results
 */
async function performDailyCleanup() {
  logger.info('Performing daily cleanup tasks');
  
  const results = {
    tempFiles: await cleanupTempFiles(),
    oldReports: await cleanupOldReports(),
    expiredSessions: await cleanupExpiredSessions(),
    logsRotation: await rotateLogFiles()
  };
  
  const totalDeleted = 
    results.tempFiles.deleted + 
    results.oldReports.deleted + 
    results.expiredSessions.deleted;
    
  const totalErrors = 
    results.tempFiles.errors + 
    results.oldReports.errors + 
    results.expiredSessions.errors + 
    results.logsRotation.errors;
  
  return {
    deleted: totalDeleted,
    errors: totalErrors,
    details: results
  };
}

/**
 * Rotate log files
 * @param {number} maxSize - Maximum size in bytes before rotation
 * @param {number} maxFiles - Maximum number of files to keep
 * @returns {Promise<Object>} - Rotation results
 */
async function rotateLogFiles(maxSize = 5 * 1024 * 1024, maxFiles = 5) {
  const logsDir = path.resolve(__dirname, '../logs');
  
  // Check if directory exists
  if (!fs.existsSync(logsDir)) {
    logger.warn(`Logs directory does not exist: ${logsDir}`);
    return { rotated: 0, deleted: 0, errors: 0 };
  }
  
  let rotated = 0;
  let deleted = 0;
  let errors = 0;
  
  // Read directory contents
  const files = fs.readdirSync(logsDir);
  
  // Group files by base name (without rotation number)
  const fileGroups = {};
  
  for (const file of files) {
    // Skip directories
    const filePath = path.join(logsDir, file);
    if (fs.statSync(filePath).isDirectory()) {
      continue;
    }
    
    // Extract base name and rotation number
    const match = file.match(/^(.+?)(?:\.(\d+))?\.log$/);
    if (!match) continue;
    
    const [, baseName, rotationNum] = match;
    const rotation = rotationNum ? parseInt(rotationNum, 10) : 0;
    
    if (!fileGroups[baseName]) {
      fileGroups[baseName] = [];
    }
    
    fileGroups[baseName].push({
      name: file,
      path: filePath,
      rotation,
      stats: fs.statSync(filePath)
    });
  }
  
  // Process each group of files
  for (const [baseName, files] of Object.entries(fileGroups)) {
    try {
      // Sort files by rotation number (descending)
      files.sort((a, b) => b.rotation - a.rotation);
      
      // Check if main log file needs rotation
      const mainLog = files.find(f => f.rotation === 0);
      if (mainLog && mainLog.stats.size > maxSize) {
        // Rotate files
        for (let i = files.length - 1; i >= 0; i--) {
          const file = files[i];
          
          if (file.rotation >= maxFiles - 1) {
            // Delete files beyond max count
            fs.unlinkSync(file.path);
            deleted++;
          } else {
            // Rename file to increment rotation
            const newPath = path.join(logsDir, `${baseName}.${file.rotation + 1}.log`);
            fs.renameSync(file.path, newPath);
            rotated++;
          }
        }
        
        // Create new empty main log file
        fs.writeFileSync(path.join(logsDir, `${baseName}.log`), '');
        rotated++;
      }
    } catch (error) {
      errors++;
      logger.error(`Error rotating log files for ${baseName}`, {
        error: error.message
      });
    }
  }
  
  return { rotated, deleted, errors };
}
