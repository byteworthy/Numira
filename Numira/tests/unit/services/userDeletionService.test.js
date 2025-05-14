/**
 * Unit Tests for User Deletion Service
 */

const userDeletionService = require('../../../services/userDeletionService');
const { PrismaClient } = require('@prisma/client');
const logger = require('../../../utils/logger');
const auditLogger = require('../../../utils/auditLogger');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/auditLogger');

describe('User Deletion Service', () => {
  let mockPrisma;
  const mockUserId = 'user123';
  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        delete: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue({ ...mockUser, isDeleted: true })
      },
      conversation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 })
      },
      message: {
        deleteMany: jest.fn().mockResolvedValue({ count: 20 })
      },
      journal: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      insight: {
        deleteMany: jest.fn().mockResolvedValue({ count: 10 })
      },
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      notification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 8 })
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub123', status: 'active' }),
        update: jest.fn().mockResolvedValue({ id: 'sub123', status: 'canceled' })
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      })
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
  });

  describe('deleteUser', () => {
    it('should delete a user and all associated data', async () => {
      const result = await userDeletionService.deleteUser(mockUserId);
      
      expect(result).toEqual({
        userId: mockUserId,
        email: mockUser.email,
        deletedData: {
          conversations: 5,
          messages: 20,
          journals: 3,
          insights: 10,
          refreshTokens: 2,
          notifications: 8
        },
        subscriptionCanceled: true
      });
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.conversation.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({
        where: { conversationId: { in: [] } }
      });
      expect(mockPrisma.journal.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.insight.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' }
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { status: 'canceled', canceledAt: expect.any(Date) }
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(auditLogger.logUserDeletion).toHaveBeenCalledWith({
        userId: mockUserId,
        email: mockUser.email,
        deletedData: {
          conversations: 5,
          messages: 20,
          journals: 3,
          insights: 10,
          refreshTokens: 2,
          notifications: 8
        }
      });
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      await expect(userDeletionService.deleteUser(mockUserId))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      
      const result = await userDeletionService.deleteUser(mockUserId);
      
      expect(result.subscriptionCanceled).toBe(false);
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle transaction errors gracefully', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction error'));
      
      await expect(userDeletionService.deleteUser(mockUserId))
        .rejects.toThrow('Failed to delete user');
      
      expect(logger.error).toHaveBeenCalledWith('Error deleting user', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete a user', async () => {
      const result = await userDeletionService.softDeleteUser(mockUserId);
      
      expect(result).toEqual({
        userId: mockUserId,
        email: mockUser.email,
        isDeleted: true,
        subscriptionCanceled: true
      });
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
          email: expect.stringContaining('deleted-'),
          password: expect.any(String)
        }
      });
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' }
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { status: 'canceled', canceledAt: expect.any(Date) }
      });
      expect(auditLogger.logUserSoftDeletion).toHaveBeenCalledWith({
        userId: mockUserId,
        email: mockUser.email
      });
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      await expect(userDeletionService.softDeleteUser(mockUserId))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      
      const result = await userDeletionService.softDeleteUser(mockUserId);
      
      expect(result.subscriptionCanceled).toBe(false);
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('Database error'));
      
      await expect(userDeletionService.softDeleteUser(mockUserId))
        .rejects.toThrow('Failed to soft delete user');
      
      expect(logger.error).toHaveBeenCalledWith('Error soft deleting user', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('anonymizeUserData', () => {
    it('should anonymize user data', async () => {
      const result = await userDeletionService.anonymizeUserData(mockUserId);
      
      expect(result).toEqual({
        userId: mockUserId,
        email: mockUser.email,
        anonymizedData: {
          conversations: 5,
          messages: 20,
          journals: 3,
          insights: 10
        }
      });
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.conversation.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.message.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.journal.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.insight.deleteMany).not.toHaveBeenCalled();
      expect(auditLogger.logUserAnonymization).toHaveBeenCalledWith({
        userId: mockUserId,
        email: mockUser.email,
        anonymizedData: {
          conversations: 5,
          messages: 20,
          journals: 3,
          insights: 10
        }
      });
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      await expect(userDeletionService.anonymizeUserData(mockUserId))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle transaction errors gracefully', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction error'));
      
      await expect(userDeletionService.anonymizeUserData(mockUserId))
        .rejects.toThrow('Failed to anonymize user data');
      
      expect(logger.error).toHaveBeenCalledWith('Error anonymizing user data', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel user subscription', async () => {
      const result = await userDeletionService.cancelSubscription(mockUserId);
      
      expect(result).toEqual({
        userId: mockUserId,
        subscriptionId: 'sub123',
        status: 'canceled'
      });
      
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' }
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub123' },
        data: { status: 'canceled', canceledAt: expect.any(Date) }
      });
      expect(auditLogger.logSubscriptionCancellation).toHaveBeenCalledWith({
        userId: mockUserId,
        subscriptionId: 'sub123'
      });
    });

    it('should handle no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      
      await expect(userDeletionService.cancelSubscription(mockUserId))
        .rejects.toThrow('No active subscription found');
      
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' }
      });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.subscription.update.mockRejectedValue(new Error('Database error'));
      
      await expect(userDeletionService.cancelSubscription(mockUserId))
        .rejects.toThrow('Failed to cancel subscription');
      
      expect(logger.error).toHaveBeenCalledWith('Error canceling subscription', {
        error: expect.any(Error),
        userId: mockUserId,
        subscriptionId: 'sub123'
      });
    });
  });

  describe('exportUserData', () => {
    it('should export user data', async () => {
      // Mock additional data for export
      mockPrisma.conversation.findMany = jest.fn().mockResolvedValue([
        { id: 'conv1', title: 'Conversation 1' }
      ]);
      mockPrisma.message.findMany = jest.fn().mockResolvedValue([
        { id: 'msg1', content: 'Message 1', conversationId: 'conv1' }
      ]);
      mockPrisma.journal.findMany = jest.fn().mockResolvedValue([
        { id: 'journal1', title: 'Journal 1', content: 'Journal content' }
      ]);
      mockPrisma.insight.findMany = jest.fn().mockResolvedValue([
        { id: 'insight1', content: 'Insight 1' }
      ]);
      
      const result = await userDeletionService.exportUserData(mockUserId);
      
      expect(result).toEqual({
        user: {
          id: mockUserId,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          createdAt: expect.any(Date)
        },
        conversations: [
          { id: 'conv1', title: 'Conversation 1' }
        ],
        messages: [
          { id: 'msg1', content: 'Message 1', conversationId: 'conv1' }
        ],
        journals: [
          { id: 'journal1', title: 'Journal 1', content: 'Journal content' }
        ],
        insights: [
          { id: 'insight1', content: 'Insight 1' }
        ]
      });
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: { in: ['conv1'] } }
      });
      expect(mockPrisma.journal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(mockPrisma.insight.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
      expect(auditLogger.logUserDataExport).toHaveBeenCalledWith({
        userId: mockUserId,
        email: mockUser.email
      });
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      await expect(userDeletionService.exportUserData(mockUserId))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
      expect(mockPrisma.conversation.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.conversation.findMany = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(userDeletionService.exportUserData(mockUserId))
        .rejects.toThrow('Failed to export user data');
      
      expect(logger.error).toHaveBeenCalledWith('Error exporting user data', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });
});
