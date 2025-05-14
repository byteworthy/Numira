/**
 * Backup Audit Logger Tests
 * 
 * Tests for the backup audit logging functionality.
 */

const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const rmdir = promisify(fs.rmdir);
const unlink = promisify(fs.unlink);

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Path to test audit logs directory
const TEST_AUDIT_LOG_DIR = path.join(__dirname, '../../../logs/audit-test');
const TEST_BACKUP_AUDIT_LOG = path.join(TEST_AUDIT_LOG_DIR, 'backup-audit.log');
const TEST_RESTORE_AUDIT_LOG = path.join(TEST_AUDIT_LOG_DIR, 'restore-audit.log');
const TEST_ACCESS_AUDIT_LOG = path.join(TEST_AUDIT_LOG_DIR, 'backup-access.log');

// Override the constants in the module for testing
jest.mock('../../../utils/backupAuditLogger', () => {
  const originalModule = jest.requireActual('../../../utils/backupAuditLogger');
  
  // Create a new module with the same functions but different constants
  const modifiedModule = {
    ...originalModule,
    // Override the constants
    AUDIT_LOG_DIR: TEST_AUDIT_LOG_DIR,
    BACKUP_AUDIT_LOG: TEST_BACKUP_AUDIT_LOG,
    RESTORE_AUDIT_LOG: TEST_RESTORE_AUDIT_LOG,
    ACCESS_AUDIT_LOG: TEST_ACCESS_AUDIT_LOG
  };
  
  return modifiedModule;
});

// Import the module after mocking
const backupAuditLogger = require('../../../utils/backupAuditLogger');

describe('Backup Audit Logger', () => {
  // Setup: create test directory and clean up any existing test logs
  beforeAll(async () => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(TEST_AUDIT_LOG_DIR)) {
      await mkdir(TEST_AUDIT_LOG_DIR, { recursive: true });
    }
    
    // Clean up any existing test logs
    for (const logFile of [TEST_BACKUP_AUDIT_LOG, TEST_RESTORE_AUDIT_LOG, TEST_ACCESS_AUDIT_LOG]) {
      if (fs.existsSync(logFile)) {
        await unlink(logFile);
      }
    }
  });
  
  // Cleanup: remove test logs and directory
  afterAll(async () => {
    // Clean up test logs
    for (const logFile of [TEST_BACKUP_AUDIT_LOG, TEST_RESTORE_AUDIT_LOG, TEST_ACCESS_AUDIT_LOG]) {
      if (fs.existsSync(logFile)) {
        await unlink(logFile);
      }
    }
    
    // Remove test directory
    if (fs.existsSync(TEST_AUDIT_LOG_DIR)) {
      await rmdir(TEST_AUDIT_LOG_DIR);
    }
  });
  
  // Test initialization
  test('should initialize audit logger', async () => {
    const result = await backupAuditLogger.initialize();
    expect(result).toBe(true);
    
    // Check that log files were created
    for (const logFile of [TEST_BACKUP_AUDIT_LOG, TEST_RESTORE_AUDIT_LOG, TEST_ACCESS_AUDIT_LOG]) {
      expect(fs.existsSync(logFile)).toBe(true);
    }
  });
  
  // Test logging backup operation
  test('should log backup operation', async () => {
    const backupData = {
      type: 'database',
      path: '/path/to/backup.sql.gz',
      userId: 'test-user',
      metadata: {
        database: 'test-db',
        sizeInMB: 10.5,
        timestamp: new Date().toISOString()
      }
    };
    
    await backupAuditLogger.logBackupOperation(backupData);
    
    // Read the log file
    const logContent = await readFile(TEST_BACKUP_AUDIT_LOG, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Parse the last log entry
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);
    
    // Check that the log entry contains the expected data
    expect(lastEntry.event).toBe('BACKUP_CREATED');
    expect(lastEntry.type).toBe(backupData.type);
    expect(lastEntry.path).toBe(backupData.path);
    expect(lastEntry.userId).toBe(backupData.userId);
    expect(lastEntry.metadata).toEqual(backupData.metadata);
    expect(lastEntry.timestamp).toBeDefined();
    expect(lastEntry.hash).toBeDefined();
  });
  
  // Test logging restore operation
  test('should log restore operation', async () => {
    const restoreData = {
      backupFile: '/path/to/backup.sql.gz',
      userId: 'test-user',
      metadata: {
        database: 'test-db',
        timestamp: new Date().toISOString()
      }
    };
    
    await backupAuditLogger.logRestoreOperation(restoreData);
    
    // Read the log file
    const logContent = await readFile(TEST_RESTORE_AUDIT_LOG, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Parse the last log entry
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);
    
    // Check that the log entry contains the expected data
    expect(lastEntry.event).toBe('BACKUP_RESTORED');
    expect(lastEntry.backupFile).toBe(restoreData.backupFile);
    expect(lastEntry.userId).toBe(restoreData.userId);
    expect(lastEntry.metadata).toEqual(restoreData.metadata);
    expect(lastEntry.timestamp).toBeDefined();
    expect(lastEntry.hash).toBeDefined();
  });
  
  // Test logging backup access
  test('should log backup access', async () => {
    const accessData = {
      backupFile: '/path/to/backup.sql.gz',
      userId: 'test-user',
      action: 'download',
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
    
    await backupAuditLogger.logBackupAccess(accessData);
    
    // Read the log file
    const logContent = await readFile(TEST_ACCESS_AUDIT_LOG, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Parse the last log entry
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);
    
    // Check that the log entry contains the expected data
    expect(lastEntry.event).toBe('BACKUP_ACCESSED');
    expect(lastEntry.backupFile).toBe(accessData.backupFile);
    expect(lastEntry.userId).toBe(accessData.userId);
    expect(lastEntry.action).toBe(accessData.action);
    expect(lastEntry.metadata).toEqual(accessData.metadata);
    expect(lastEntry.timestamp).toBeDefined();
    expect(lastEntry.hash).toBeDefined();
  });
  
  // Test verifying log integrity
  test('should verify log integrity', async () => {
    // Log a few more entries to create a chain
    for (let i = 0; i < 3; i++) {
      await backupAuditLogger.logBackupOperation({
        type: 'database',
        path: `/path/to/backup${i}.sql.gz`,
        userId: 'test-user',
        metadata: { index: i }
      });
    }
    
    // Verify log integrity
    const results = await backupAuditLogger.verifyLogIntegrity();
    
    // Check that all logs are valid
    expect(results['backup-audit.log'].verified).toBe(true);
    expect(results['restore-audit.log'].verified).toBe(true);
    expect(results['backup-access.log'].verified).toBe(true);
  });
  
  // Test tampering detection
  test('should detect tampering', async () => {
    // Tamper with the backup audit log
    const logContent = await readFile(TEST_BACKUP_AUDIT_LOG, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Parse the second log entry (not the first, as it has no previous hash)
    const secondEntry = JSON.parse(logLines[1]);
    
    // Modify the entry
    secondEntry.userId = 'hacker';
    
    // Write the tampered log back
    const tamperedLogLines = [
      logLines[0],
      JSON.stringify(secondEntry),
      ...logLines.slice(2)
    ];
    
    await writeFile(TEST_BACKUP_AUDIT_LOG, tamperedLogLines.join('\n'));
    
    // Verify log integrity
    const results = await backupAuditLogger.verifyLogIntegrity();
    
    // Check that the tampered log is detected
    expect(results['backup-audit.log'].verified).toBe(false);
    expect(results['backup-audit.log'].invalidEntries).toBeDefined();
    expect(results['backup-audit.log'].invalidEntries.length).toBeGreaterThan(0);
  });
});
