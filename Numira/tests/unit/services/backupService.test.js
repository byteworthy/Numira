/**
 * Unit Tests for Backup Service
 */

const backupService = require('../../../services/backupService');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');
const backupAuditLogger = require('../../../utils/backupAuditLogger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('fs');
jest.mock('path');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/backupAuditLogger');
jest.mock('../../../config/config', () => ({
  backup: {
    directory: '/backup/directory',
    retentionDays: 30,
    compressionLevel: 9
  }
}));

describe('Backup Service', () => {
  let mockPrisma;
  const mockDate = new Date('2025-01-01T12:00:00Z');
  const mockBackupFileName = '20250101_120000_backup.gz';
  const mockBackupFilePath = '/backup/directory/20250101_120000_backup.gz';
  const mockBackupData = {
    users: [{ id: 'user1', email: 'user1@example.com' }],
    conversations: [{ id: 'conv1', userId: 'user1' }],
    messages: [{ id: 'msg1', conversationId: 'conv1', content: 'Hello' }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Date
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    // Mock Prisma client
    mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(mockBackupData.users)
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue(mockBackupData.conversations)
      },
      message: {
        findMany: jest.fn().mockResolvedValue(mockBackupData.messages)
      }
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
    
    // Mock fs
    fs.promises = {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(JSON.stringify(mockBackupData)),
      readdir: jest.fn().mockResolvedValue([mockBackupFileName, 'old_backup.gz']),
      stat: jest.fn().mockResolvedValue({ mtime: new Date('2024-12-01') }),
      unlink: jest.fn().mockResolvedValue(undefined)
    };
    
    // Mock path
    path.join.mockImplementation((...args) => args.join('/'));
    
    // Mock backupAuditLogger
    backupAuditLogger.logBackupCreated.mockResolvedValue(undefined);
    backupAuditLogger.logBackupRestored.mockResolvedValue(undefined);
    backupAuditLogger.logBackupDeleted.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const result = await backupService.createBackup();
      
      expect(result).toEqual({
        fileName: mockBackupFileName,
        filePath: mockBackupFilePath,
        timestamp: mockDate.toISOString(),
        size: expect.any(Number)
      });
      
      expect(fs.promises.mkdir).toHaveBeenCalledWith(config.backup.directory, { recursive: true });
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      expect(mockPrisma.conversation.findMany).toHaveBeenCalled();
      expect(mockPrisma.message.findMany).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        mockBackupFilePath,
        expect.any(String)
      );
      expect(backupAuditLogger.logBackupCreated).toHaveBeenCalledWith({
        fileName: mockBackupFileName,
        filePath: mockBackupFilePath,
        timestamp: mockDate.toISOString(),
        size: expect.any(Number)
      });
    });

    it('should handle file system errors gracefully', async () => {
      fs.promises.mkdir.mockRejectedValue(new Error('File system error'));
      
      await expect(backupService.createBackup())
        .rejects.toThrow('Failed to create backup directory');
      
      expect(logger.error).toHaveBeenCalledWith('Error creating backup directory', {
        error: expect.any(Error),
        directory: config.backup.directory
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(backupService.createBackup())
        .rejects.toThrow('Failed to fetch data for backup');
      
      expect(logger.error).toHaveBeenCalledWith('Error fetching data for backup', {
        error: expect.any(Error)
      });
    });

    it('should handle write errors gracefully', async () => {
      fs.promises.writeFile.mockRejectedValue(new Error('Write error'));
      
      await expect(backupService.createBackup())
        .rejects.toThrow('Failed to write backup file');
      
      expect(logger.error).toHaveBeenCalledWith('Error writing backup file', {
        error: expect.any(Error),
        filePath: mockBackupFilePath
      });
    });
  });

  describe('restoreBackup', () => {
    it('should restore a backup successfully', async () => {
      // Mock transaction
      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });
      
      // Mock delete and create operations
      mockPrisma.user.deleteMany = jest.fn().mockResolvedValue({ count: 5 });
      mockPrisma.conversation.deleteMany = jest.fn().mockResolvedValue({ count: 10 });
      mockPrisma.message.deleteMany = jest.fn().mockResolvedValue({ count: 50 });
      
      mockPrisma.user.createMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.conversation.createMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.message.createMany = jest.fn().mockResolvedValue({ count: 1 });
      
      const result = await backupService.restoreBackup(mockBackupFileName);
      
      expect(result).toEqual({
        fileName: mockBackupFileName,
        timestamp: expect.any(String),
        entitiesRestored: {
          users: 1,
          conversations: 1,
          messages: 1
        }
      });
      
      expect(fs.promises.readFile).toHaveBeenCalledWith(mockBackupFilePath);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.conversation.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.message.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.user.createMany).toHaveBeenCalledWith({ data: mockBackupData.users });
      expect(mockPrisma.conversation.createMany).toHaveBeenCalledWith({ data: mockBackupData.conversations });
      expect(mockPrisma.message.createMany).toHaveBeenCalledWith({ data: mockBackupData.messages });
      expect(backupAuditLogger.logBackupRestored).toHaveBeenCalledWith({
        fileName: mockBackupFileName,
        timestamp: expect.any(String),
        entitiesRestored: {
          users: 1,
          conversations: 1,
          messages: 1
        }
      });
    });

    it('should throw error when backup file does not exist', async () => {
      fs.promises.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(backupService.restoreBackup('nonexistent.gz'))
        .rejects.toThrow('Backup file not found');
      
      expect(logger.error).toHaveBeenCalledWith('Error reading backup file', {
        error: expect.any(Error),
        fileName: 'nonexistent.gz'
      });
    });

    it('should throw error when backup file is invalid', async () => {
      fs.promises.readFile.mockResolvedValue('invalid json');
      
      await expect(backupService.restoreBackup(mockBackupFileName))
        .rejects.toThrow('Invalid backup file format');
      
      expect(logger.error).toHaveBeenCalledWith('Error parsing backup file', {
        error: expect.any(Error),
        fileName: mockBackupFileName
      });
    });

    it('should handle database transaction errors gracefully', async () => {
      mockPrisma.$transaction = jest.fn().mockRejectedValue(new Error('Transaction error'));
      
      await expect(backupService.restoreBackup(mockBackupFileName))
        .rejects.toThrow('Failed to restore backup');
      
      expect(logger.error).toHaveBeenCalledWith('Error during backup restoration transaction', {
        error: expect.any(Error),
        fileName: mockBackupFileName
      });
    });
  });

  describe('listBackups', () => {
    it('should list all backups', async () => {
      const result = await backupService.listBackups();
      
      expect(result).toEqual([
        {
          fileName: mockBackupFileName,
          timestamp: expect.any(String),
          size: expect.any(Number)
        },
        {
          fileName: 'old_backup.gz',
          timestamp: expect.any(String),
          size: expect.any(Number)
        }
      ]);
      
      expect(fs.promises.readdir).toHaveBeenCalledWith(config.backup.directory);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);
    });

    it('should handle directory not found gracefully', async () => {
      fs.promises.readdir.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await backupService.listBackups();
      
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Backup directory does not exist', {
        directory: config.backup.directory
      });
    });

    it('should handle other file system errors gracefully', async () => {
      fs.promises.readdir.mockRejectedValue(new Error('File system error'));
      
      await expect(backupService.listBackups())
        .rejects.toThrow('Failed to list backups');
      
      expect(logger.error).toHaveBeenCalledWith('Error listing backups', {
        error: expect.any(Error),
        directory: config.backup.directory
      });
    });
  });

  describe('cleanupOldBackups', () => {
    it('should delete backups older than retention period', async () => {
      // Mock an old backup file
      const oldDate = new Date('2024-01-01');
      fs.promises.stat.mockResolvedValueOnce({ mtime: oldDate });
      
      const result = await backupService.cleanupOldBackups();
      
      expect(result).toEqual({
        deletedCount: 1,
        deletedFiles: ['old_backup.gz']
      });
      
      expect(fs.promises.readdir).toHaveBeenCalledWith(config.backup.directory);
      expect(fs.promises.stat).toHaveBeenCalledWith(path.join(config.backup.directory, 'old_backup.gz'));
      expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(config.backup.directory, 'old_backup.gz'));
      expect(backupAuditLogger.logBackupDeleted).toHaveBeenCalledWith({
        fileName: 'old_backup.gz',
        reason: 'retention policy'
      });
    });

    it('should not delete backups within retention period', async () => {
      // Mock a recent backup file
      const recentDate = new Date();
      fs.promises.stat.mockResolvedValue({ mtime: recentDate });
      
      const result = await backupService.cleanupOldBackups();
      
      expect(result).toEqual({
        deletedCount: 0,
        deletedFiles: []
      });
      
      expect(fs.promises.readdir).toHaveBeenCalledWith(config.backup.directory);
      expect(fs.promises.stat).toHaveBeenCalledTimes(2);
      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should handle file system errors gracefully', async () => {
      fs.promises.readdir.mockRejectedValue(new Error('File system error'));
      
      await expect(backupService.cleanupOldBackups())
        .rejects.toThrow('Failed to cleanup old backups');
      
      expect(logger.error).toHaveBeenCalledWith('Error cleaning up old backups', {
        error: expect.any(Error),
        directory: config.backup.directory
      });
    });

    it('should handle deletion errors gracefully', async () => {
      // Mock an old backup file
      const oldDate = new Date('2024-01-01');
      fs.promises.stat.mockResolvedValueOnce({ mtime: oldDate });
      
      // Mock deletion error
      fs.promises.unlink.mockRejectedValue(new Error('Deletion error'));
      
      const result = await backupService.cleanupOldBackups();
      
      expect(result).toEqual({
        deletedCount: 0,
        deletedFiles: [],
        errors: [
          {
            fileName: 'old_backup.gz',
            error: expect.any(Error)
          }
        ]
      });
      
      expect(logger.error).toHaveBeenCalledWith('Error deleting backup file', {
        error: expect.any(Error),
        fileName: 'old_backup.gz'
      });
    });
  });

  describe('getBackupInfo', () => {
    it('should return backup info for a valid backup file', async () => {
      const result = await backupService.getBackupInfo(mockBackupFileName);
      
      expect(result).toEqual({
        fileName: mockBackupFileName,
        timestamp: expect.any(String),
        size: expect.any(Number),
        entities: {
          users: 1,
          conversations: 1,
          messages: 1
        }
      });
      
      expect(fs.promises.readFile).toHaveBeenCalledWith(mockBackupFilePath);
    });

    it('should throw error when backup file does not exist', async () => {
      fs.promises.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(backupService.getBackupInfo('nonexistent.gz'))
        .rejects.toThrow('Backup file not found');
      
      expect(logger.error).toHaveBeenCalledWith('Error reading backup file', {
        error: expect.any(Error),
        fileName: 'nonexistent.gz'
      });
    });

    it('should throw error when backup file is invalid', async () => {
      fs.promises.readFile.mockResolvedValue('invalid json');
      
      await expect(backupService.getBackupInfo(mockBackupFileName))
        .rejects.toThrow('Invalid backup file format');
      
      expect(logger.error).toHaveBeenCalledWith('Error parsing backup file', {
        error: expect.any(Error),
        fileName: mockBackupFileName
      });
    });
  });
});
