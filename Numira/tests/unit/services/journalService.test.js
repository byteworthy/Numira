/**
 * Unit Tests for Journal Service
 */

const journalService = require('../../../services/journalService');
const { PrismaClient } = require('@prisma/client');
const logger = require('../../../utils/logger');
const phiDetector = require('../../../utils/phiDetector');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/phiDetector');

describe('Journal Service', () => {
  let mockPrisma;
  const mockUserId = 'user123';
  const mockJournalId = 'journal123';
  const mockJournalEntry = {
    id: mockJournalId,
    userId: mockUserId,
    title: 'Test Journal',
    content: 'Test content',
    mood: 'happy',
    tags: ['test', 'journal'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      journal: {
        create: jest.fn().mockResolvedValue(mockJournalEntry),
        findUnique: jest.fn().mockResolvedValue(mockJournalEntry),
        findMany: jest.fn().mockResolvedValue([mockJournalEntry]),
        update: jest.fn().mockResolvedValue(mockJournalEntry),
        delete: jest.fn().mockResolvedValue(mockJournalEntry),
        count: jest.fn().mockResolvedValue(1)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: mockUserId, email: 'test@example.com' })
      }
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
    
    // Mock phiDetector
    phiDetector.containsPHI.mockReturnValue(false);
    phiDetector.getPHIDetectionMessage.mockReturnValue('PHI detected message');
  });

  describe('createJournal', () => {
    it('should create a new journal entry', async () => {
      const journalData = {
        title: 'Test Journal',
        content: 'Test content',
        mood: 'happy',
        tags: ['test', 'journal']
      };
      
      const result = await journalService.createJournal(mockUserId, journalData);
      
      expect(result).toEqual(mockJournalEntry);
      expect(mockPrisma.journal.create).toHaveBeenCalledWith({
        data: {
          ...journalData,
          userId: mockUserId
        }
      });
      expect(phiDetector.containsPHI).toHaveBeenCalledWith(journalData.content);
    });

    it('should throw error when PHI is detected', async () => {
      phiDetector.containsPHI.mockReturnValue(true);
      
      const journalData = {
        title: 'Test Journal',
        content: 'Content with PHI',
        mood: 'happy',
        tags: ['test', 'journal']
      };
      
      await expect(journalService.createJournal(mockUserId, journalData))
        .rejects.toThrow('PHI detected message');
      
      expect(phiDetector.containsPHI).toHaveBeenCalledWith(journalData.content);
      expect(phiDetector.getPHIDetectionMessage).toHaveBeenCalledWith('journal');
      expect(mockPrisma.journal.create).not.toHaveBeenCalled();
    });

    it('should throw error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const journalData = {
        title: 'Test Journal',
        content: 'Test content',
        mood: 'happy',
        tags: ['test', 'journal']
      };
      
      await expect(journalService.createJournal(mockUserId, journalData))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.journal.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.create.mockRejectedValue(new Error('Database error'));
      
      const journalData = {
        title: 'Test Journal',
        content: 'Test content',
        mood: 'happy',
        tags: ['test', 'journal']
      };
      
      await expect(journalService.createJournal(mockUserId, journalData))
        .rejects.toThrow('Failed to create journal entry');
      
      expect(logger.error).toHaveBeenCalledWith('Error creating journal entry', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('getJournal', () => {
    it('should get a journal entry by id', async () => {
      const result = await journalService.getJournal(mockUserId, mockJournalId);
      
      expect(result).toEqual(mockJournalEntry);
      expect(mockPrisma.journal.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        }
      });
    });

    it('should throw error when journal is not found', async () => {
      mockPrisma.journal.findUnique.mockResolvedValue(null);
      
      await expect(journalService.getJournal(mockUserId, mockJournalId))
        .rejects.toThrow('Journal entry not found');
      
      expect(mockPrisma.journal.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.findUnique.mockRejectedValue(new Error('Database error'));
      
      await expect(journalService.getJournal(mockUserId, mockJournalId))
        .rejects.toThrow('Failed to retrieve journal entry');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving journal entry', {
        error: expect.any(Error),
        userId: mockUserId,
        journalId: mockJournalId
      });
    });
  });

  describe('getUserJournals', () => {
    it('should get all journal entries for a user', async () => {
      const result = await journalService.getUserJournals(mockUserId);
      
      expect(result).toEqual([mockJournalEntry]);
      expect(mockPrisma.journal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should apply pagination when specified', async () => {
      const page = 2;
      const limit = 10;
      
      await journalService.getUserJournals(mockUserId, { page, limit });
      
      expect(mockPrisma.journal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });
    });

    it('should apply filters when specified', async () => {
      const filters = {
        mood: 'happy',
        tags: ['test'],
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };
      
      await journalService.getUserJournals(mockUserId, { filters });
      
      expect(mockPrisma.journal.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          mood: filters.mood,
          tags: { hasSome: filters.tags },
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(journalService.getUserJournals(mockUserId))
        .rejects.toThrow('Failed to retrieve journal entries');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving journal entries', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('updateJournal', () => {
    it('should update a journal entry', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        mood: 'neutral'
      };
      
      const result = await journalService.updateJournal(mockUserId, mockJournalId, updateData);
      
      expect(result).toEqual(mockJournalEntry);
      expect(mockPrisma.journal.update).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        },
        data: updateData
      });
      expect(phiDetector.containsPHI).toHaveBeenCalledWith(updateData.content);
    });

    it('should throw error when PHI is detected', async () => {
      phiDetector.containsPHI.mockReturnValue(true);
      
      const updateData = {
        content: 'Updated content with PHI'
      };
      
      await expect(journalService.updateJournal(mockUserId, mockJournalId, updateData))
        .rejects.toThrow('PHI detected message');
      
      expect(phiDetector.containsPHI).toHaveBeenCalledWith(updateData.content);
      expect(phiDetector.getPHIDetectionMessage).toHaveBeenCalledWith('journal');
      expect(mockPrisma.journal.update).not.toHaveBeenCalled();
    });

    it('should throw error when journal is not found', async () => {
      mockPrisma.journal.update.mockRejectedValue(new Error('Record not found'));
      
      const updateData = {
        title: 'Updated Title'
      };
      
      await expect(journalService.updateJournal(mockUserId, mockJournalId, updateData))
        .rejects.toThrow('Journal entry not found or you do not have permission to update it');
      
      expect(mockPrisma.journal.update).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        },
        data: updateData
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.update.mockRejectedValue(new Error('Database error'));
      
      const updateData = {
        title: 'Updated Title'
      };
      
      await expect(journalService.updateJournal(mockUserId, mockJournalId, updateData))
        .rejects.toThrow('Failed to update journal entry');
      
      expect(logger.error).toHaveBeenCalledWith('Error updating journal entry', {
        error: expect.any(Error),
        userId: mockUserId,
        journalId: mockJournalId
      });
    });
  });

  describe('deleteJournal', () => {
    it('should delete a journal entry', async () => {
      const result = await journalService.deleteJournal(mockUserId, mockJournalId);
      
      expect(result).toEqual(mockJournalEntry);
      expect(mockPrisma.journal.delete).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        }
      });
    });

    it('should throw error when journal is not found', async () => {
      mockPrisma.journal.delete.mockRejectedValue(new Error('Record not found'));
      
      await expect(journalService.deleteJournal(mockUserId, mockJournalId))
        .rejects.toThrow('Journal entry not found or you do not have permission to delete it');
      
      expect(mockPrisma.journal.delete).toHaveBeenCalledWith({
        where: {
          id: mockJournalId,
          userId: mockUserId
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.delete.mockRejectedValue(new Error('Database error'));
      
      await expect(journalService.deleteJournal(mockUserId, mockJournalId))
        .rejects.toThrow('Failed to delete journal entry');
      
      expect(logger.error).toHaveBeenCalledWith('Error deleting journal entry', {
        error: expect.any(Error),
        userId: mockUserId,
        journalId: mockJournalId
      });
    });
  });

  describe('countUserJournals', () => {
    it('should count journal entries for a user', async () => {
      const result = await journalService.countUserJournals(mockUserId);
      
      expect(result).toBe(1);
      expect(mockPrisma.journal.count).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
    });

    it('should apply filters when specified', async () => {
      const filters = {
        mood: 'happy',
        tags: ['test'],
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };
      
      await journalService.countUserJournals(mockUserId, { filters });
      
      expect(mockPrisma.journal.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          mood: filters.mood,
          tags: { hasSome: filters.tags },
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.journal.count.mockRejectedValue(new Error('Database error'));
      
      await expect(journalService.countUserJournals(mockUserId))
        .rejects.toThrow('Failed to count journal entries');
      
      expect(logger.error).toHaveBeenCalledWith('Error counting journal entries', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });
});
