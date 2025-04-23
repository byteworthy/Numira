/**
 * Journal Service Unit Tests
 * 
 * Tests for the journal service functionality.
 */

const { PrismaClient } = require('@prisma/client');
const journalService = require('../../../services/journalService');

// Mock the Prisma client
jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockDelete = jest.fn();
  const mockCount = jest.fn();

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      journal: {
        create: mockCreate,
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        delete: mockDelete,
        count: mockCount
      },
      $disconnect: jest.fn()
    }))
  };
});

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('Journal Service', () => {
  let prisma;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Get the mocked Prisma client instance
    prisma = new PrismaClient();
  });

  describe('createJournalEntry', () => {
    it('should create a journal entry successfully', async () => {
      // Arrange
      const userId = 'user123';
      const personaId = 'ayla';
      const roomId = 'clarityBar';
      const prompt = 'How can I manage stress?';
      const response = 'Here are some stress management techniques...';
      
      const mockJournal = {
        id: 'journal123',
        userId,
        personaId,
        roomId,
        prompt,
        response,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      prisma.journal.create.mockResolvedValue(mockJournal);
      
      // Act
      const result = await journalService.createJournalEntry(
        userId,
        personaId,
        roomId,
        prompt,
        response
      );
      
      // Assert
      expect(prisma.journal.create).toHaveBeenCalledWith({
        data: {
          userId,
          personaId,
          roomId,
          prompt,
          response
        }
      });
      
      expect(result).toEqual(mockJournal);
    });
    
    it('should throw an error if required parameters are missing', async () => {
      // Arrange
      const userId = 'user123';
      const personaId = 'ayla';
      const roomId = 'clarityBar';
      const prompt = '';  // Empty prompt
      const response = 'Here are some stress management techniques...';
      
      // Act & Assert
      await expect(
        journalService.createJournalEntry(userId, personaId, roomId, prompt, response)
      ).rejects.toThrow('Missing required parameters for journal entry');
      
      expect(prisma.journal.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserJournals', () => {
    it('should get all journal entries for a user with default options', async () => {
      // Arrange
      const userId = 'user123';
      const mockJournals = [
        { id: 'journal1', userId, prompt: 'Prompt 1', response: 'Response 1' },
        { id: 'journal2', userId, prompt: 'Prompt 2', response: 'Response 2' }
      ];
      
      prisma.journal.findMany.mockResolvedValue(mockJournals);
      prisma.journal.count.mockResolvedValue(2);
      
      // Act
      const result = await journalService.getUserJournals(userId);
      
      // Assert
      expect(prisma.journal.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20
      });
      
      expect(prisma.journal.count).toHaveBeenCalledWith({
        where: { userId }
      });
      
      expect(result).toEqual({
        journals: mockJournals,
        pagination: {
          total: 2,
          limit: 20,
          offset: 0,
          hasMore: false
        }
      });
    });
    
    it('should get journal entries with custom pagination options', async () => {
      // Arrange
      const userId = 'user123';
      const options = {
        limit: 5,
        offset: 10,
        sortBy: 'updatedAt',
        sortOrder: 'asc'
      };
      
      const mockJournals = [
        { id: 'journal11', userId, prompt: 'Prompt 11', response: 'Response 11' },
        { id: 'journal12', userId, prompt: 'Prompt 12', response: 'Response 12' }
      ];
      
      prisma.journal.findMany.mockResolvedValue(mockJournals);
      prisma.journal.count.mockResolvedValue(15);
      
      // Act
      const result = await journalService.getUserJournals(userId, options);
      
      // Assert
      expect(prisma.journal.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { updatedAt: 'asc' },
        skip: 10,
        take: 5
      });
      
      expect(result).toEqual({
        journals: mockJournals,
        pagination: {
          total: 15,
          limit: 5,
          offset: 10,
          hasMore: false
        }
      });
    });
    
    it('should throw an error if userId is not provided', async () => {
      // Act & Assert
      await expect(journalService.getUserJournals()).rejects.toThrow('User ID is required');
      expect(prisma.journal.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getJournalById', () => {
    it('should get a journal entry by ID if it belongs to the user', async () => {
      // Arrange
      const journalId = 'journal123';
      const userId = 'user123';
      
      const mockJournal = {
        id: journalId,
        userId,
        personaId: 'ayla',
        roomId: 'clarityBar',
        prompt: 'How can I manage stress?',
        response: 'Here are some stress management techniques...'
      };
      
      prisma.journal.findUnique.mockResolvedValue(mockJournal);
      
      // Act
      const result = await journalService.getJournalById(journalId, userId);
      
      // Assert
      expect(prisma.journal.findUnique).toHaveBeenCalledWith({
        where: { id: journalId }
      });
      
      expect(result).toEqual(mockJournal);
    });
    
    it('should throw an error if journal is not found', async () => {
      // Arrange
      const journalId = 'nonexistent';
      const userId = 'user123';
      
      prisma.journal.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(journalService.getJournalById(journalId, userId))
        .rejects.toThrow('Journal entry not found');
    });
    
    it('should throw an error if journal does not belong to the user', async () => {
      // Arrange
      const journalId = 'journal123';
      const userId = 'user123';
      const differentUserId = 'user456';
      
      const mockJournal = {
        id: journalId,
        userId: differentUserId,  // Different user ID
        personaId: 'ayla',
        roomId: 'clarityBar',
        prompt: 'How can I manage stress?',
        response: 'Here are some stress management techniques...'
      };
      
      prisma.journal.findUnique.mockResolvedValue(mockJournal);
      
      // Act & Assert
      await expect(journalService.getJournalById(journalId, userId))
        .rejects.toThrow('Unauthorized access to journal entry');
    });
  });

  describe('deleteJournal', () => {
    it('should delete a journal entry if it belongs to the user', async () => {
      // Arrange
      const journalId = 'journal123';
      const userId = 'user123';
      
      const mockJournal = {
        id: journalId,
        userId,
        personaId: 'ayla',
        roomId: 'clarityBar',
        prompt: 'How can I manage stress?',
        response: 'Here are some stress management techniques...'
      };
      
      prisma.journal.findUnique.mockResolvedValue(mockJournal);
      prisma.journal.delete.mockResolvedValue(mockJournal);
      
      // Act
      const result = await journalService.deleteJournal(journalId, userId);
      
      // Assert
      expect(prisma.journal.findUnique).toHaveBeenCalledWith({
        where: { id: journalId }
      });
      
      expect(prisma.journal.delete).toHaveBeenCalledWith({
        where: { id: journalId }
      });
      
      expect(result).toEqual(mockJournal);
    });
    
    it('should throw an error if journal is not found', async () => {
      // Arrange
      const journalId = 'nonexistent';
      const userId = 'user123';
      
      prisma.journal.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(journalService.deleteJournal(journalId, userId))
        .rejects.toThrow('Journal entry not found');
      
      expect(prisma.journal.delete).not.toHaveBeenCalled();
    });
    
    it('should throw an error if journal does not belong to the user', async () => {
      // Arrange
      const journalId = 'journal123';
      const userId = 'user123';
      const differentUserId = 'user456';
      
      const mockJournal = {
        id: journalId,
        userId: differentUserId,  // Different user ID
        personaId: 'ayla',
        roomId: 'clarityBar',
        prompt: 'How can I manage stress?',
        response: 'Here are some stress management techniques...'
      };
      
      prisma.journal.findUnique.mockResolvedValue(mockJournal);
      
      // Act & Assert
      await expect(journalService.deleteJournal(journalId, userId))
        .rejects.toThrow('Unauthorized access to journal entry');
      
      expect(prisma.journal.delete).not.toHaveBeenCalled();
    });
  });
});
