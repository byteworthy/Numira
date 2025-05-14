/**
 * Unit Tests for Feedback Service
 */

const feedbackService = require('../../../services/feedbackService');
const { PrismaClient } = require('@prisma/client');
const logger = require('../../../utils/logger');
const auditLogger = require('../../../utils/auditLogger');
const analyticsService = require('../../../services/analyticsService');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/auditLogger');
jest.mock('../../../services/analyticsService');

describe('Feedback Service', () => {
  let mockPrisma;
  const mockUserId = 'user123';
  const mockFeedbackId = 'feedback123';
  const mockSessionId = 'session123';
  const mockFeedback = {
    id: mockFeedbackId,
    userId: mockUserId,
    sessionId: mockSessionId,
    rating: 4,
    comment: 'Great experience!',
    category: 'session',
    tags: ['helpful', 'insightful'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      feedback: {
        create: jest.fn().mockResolvedValue(mockFeedback),
        findUnique: jest.fn().mockResolvedValue(mockFeedback),
        findMany: jest.fn().mockResolvedValue([mockFeedback]),
        update: jest.fn().mockResolvedValue(mockFeedback),
        delete: jest.fn().mockResolvedValue(mockFeedback),
        count: jest.fn().mockResolvedValue(1)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: mockUserId, email: 'test@example.com' })
      },
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: mockSessionId, userId: mockUserId })
      }
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
    
    // Mock analyticsService
    analyticsService.trackEvent.mockResolvedValue(undefined);
  });

  describe('createFeedback', () => {
    it('should create a new feedback entry', async () => {
      const feedbackData = {
        sessionId: mockSessionId,
        rating: 4,
        comment: 'Great experience!',
        category: 'session',
        tags: ['helpful', 'insightful']
      };
      
      const result = await feedbackService.createFeedback(mockUserId, feedbackData);
      
      expect(result).toEqual(mockFeedback);
      expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
        data: {
          ...feedbackData,
          userId: mockUserId
        }
      });
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('feedback_submitted', {
        userId: mockUserId,
        sessionId: mockSessionId,
        rating: 4,
        category: 'session',
        tags: ['helpful', 'insightful']
      });
      expect(auditLogger.logFeedbackCreation).toHaveBeenCalledWith({
        userId: mockUserId,
        feedbackId: mockFeedbackId,
        sessionId: mockSessionId,
        category: 'session'
      });
    });

    it('should validate rating is between 1 and 5', async () => {
      const feedbackData = {
        sessionId: mockSessionId,
        rating: 6, // Invalid rating
        comment: 'Great experience!',
        category: 'session'
      };
      
      await expect(feedbackService.createFeedback(mockUserId, feedbackData))
        .rejects.toThrow('Rating must be between 1 and 5');
      
      expect(mockPrisma.feedback.create).not.toHaveBeenCalled();
    });

    it('should validate category is valid', async () => {
      const feedbackData = {
        sessionId: mockSessionId,
        rating: 4,
        comment: 'Great experience!',
        category: 'invalid_category' // Invalid category
      };
      
      await expect(feedbackService.createFeedback(mockUserId, feedbackData))
        .rejects.toThrow('Invalid feedback category');
      
      expect(mockPrisma.feedback.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.create.mockRejectedValue(new Error('Database error'));
      
      const feedbackData = {
        sessionId: mockSessionId,
        rating: 4,
        comment: 'Great experience!',
        category: 'session'
      };
      
      await expect(feedbackService.createFeedback(mockUserId, feedbackData))
        .rejects.toThrow('Failed to create feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error creating feedback', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('getFeedback', () => {
    it('should get a feedback entry by id', async () => {
      const result = await feedbackService.getFeedback(mockFeedbackId);
      
      expect(result).toEqual(mockFeedback);
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
    });

    it('should throw error when feedback is not found', async () => {
      mockPrisma.feedback.findUnique.mockResolvedValue(null);
      
      await expect(feedbackService.getFeedback(mockFeedbackId))
        .rejects.toThrow('Feedback not found');
      
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.findUnique.mockRejectedValue(new Error('Database error'));
      
      await expect(feedbackService.getFeedback(mockFeedbackId))
        .rejects.toThrow('Failed to retrieve feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving feedback', {
        error: expect.any(Error),
        feedbackId: mockFeedbackId
      });
    });
  });

  describe('getUserFeedback', () => {
    it('should get all feedback entries for a user', async () => {
      const result = await feedbackService.getUserFeedback(mockUserId);
      
      expect(result).toEqual([mockFeedback]);
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should apply pagination when specified', async () => {
      const page = 2;
      const limit = 10;
      
      await feedbackService.getUserFeedback(mockUserId, { page, limit });
      
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });
    });

    it('should apply filters when specified', async () => {
      const filters = {
        category: 'session',
        rating: 4,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };
      
      await feedbackService.getUserFeedback(mockUserId, { filters });
      
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          category: filters.category,
          rating: filters.rating,
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(feedbackService.getUserFeedback(mockUserId))
        .rejects.toThrow('Failed to retrieve user feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving user feedback', {
        error: expect.any(Error),
        userId: mockUserId
      });
    });
  });

  describe('getSessionFeedback', () => {
    it('should get all feedback entries for a session', async () => {
      const result = await feedbackService.getSessionFeedback(mockSessionId);
      
      expect(result).toEqual([mockFeedback]);
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: { sessionId: mockSessionId },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(feedbackService.getSessionFeedback(mockSessionId))
        .rejects.toThrow('Failed to retrieve session feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving session feedback', {
        error: expect.any(Error),
        sessionId: mockSessionId
      });
    });
  });

  describe('updateFeedback', () => {
    it('should update a feedback entry', async () => {
      const updateData = {
        rating: 5,
        comment: 'Updated comment'
      };
      
      const result = await feedbackService.updateFeedback(mockFeedbackId, mockUserId, updateData);
      
      expect(result).toEqual(mockFeedback);
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.update).toHaveBeenCalledWith({
        where: { id: mockFeedbackId },
        data: updateData
      });
      expect(auditLogger.logFeedbackUpdate).toHaveBeenCalledWith({
        userId: mockUserId,
        feedbackId: mockFeedbackId,
        updates: updateData
      });
    });

    it('should throw error when feedback is not found', async () => {
      mockPrisma.feedback.findUnique.mockResolvedValue(null);
      
      const updateData = {
        rating: 5,
        comment: 'Updated comment'
      };
      
      await expect(feedbackService.updateFeedback(mockFeedbackId, mockUserId, updateData))
        .rejects.toThrow('Feedback not found');
      
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.update).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own the feedback', async () => {
      const differentUserId = 'user456';
      
      const updateData = {
        rating: 5,
        comment: 'Updated comment'
      };
      
      await expect(feedbackService.updateFeedback(mockFeedbackId, differentUserId, updateData))
        .rejects.toThrow('You do not have permission to update this feedback');
      
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.update).not.toHaveBeenCalled();
    });

    it('should validate rating is between 1 and 5', async () => {
      const updateData = {
        rating: 0, // Invalid rating
        comment: 'Updated comment'
      };
      
      await expect(feedbackService.updateFeedback(mockFeedbackId, mockUserId, updateData))
        .rejects.toThrow('Rating must be between 1 and 5');
      
      expect(mockPrisma.feedback.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.update.mockRejectedValue(new Error('Database error'));
      
      const updateData = {
        rating: 5,
        comment: 'Updated comment'
      };
      
      await expect(feedbackService.updateFeedback(mockFeedbackId, mockUserId, updateData))
        .rejects.toThrow('Failed to update feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error updating feedback', {
        error: expect.any(Error),
        feedbackId: mockFeedbackId,
        userId: mockUserId
      });
    });
  });

  describe('deleteFeedback', () => {
    it('should delete a feedback entry', async () => {
      const result = await feedbackService.deleteFeedback(mockFeedbackId, mockUserId);
      
      expect(result).toEqual(mockFeedback);
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.delete).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(auditLogger.logFeedbackDeletion).toHaveBeenCalledWith({
        userId: mockUserId,
        feedbackId: mockFeedbackId,
        category: mockFeedback.category
      });
    });

    it('should throw error when feedback is not found', async () => {
      mockPrisma.feedback.findUnique.mockResolvedValue(null);
      
      await expect(feedbackService.deleteFeedback(mockFeedbackId, mockUserId))
        .rejects.toThrow('Feedback not found');
      
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own the feedback', async () => {
      const differentUserId = 'user456';
      
      await expect(feedbackService.deleteFeedback(mockFeedbackId, differentUserId))
        .rejects.toThrow('You do not have permission to delete this feedback');
      
      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: mockFeedbackId }
      });
      expect(mockPrisma.feedback.delete).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.delete.mockRejectedValue(new Error('Database error'));
      
      await expect(feedbackService.deleteFeedback(mockFeedbackId, mockUserId))
        .rejects.toThrow('Failed to delete feedback');
      
      expect(logger.error).toHaveBeenCalledWith('Error deleting feedback', {
        error: expect.any(Error),
        feedbackId: mockFeedbackId,
        userId: mockUserId
      });
    });
  });

  describe('getFeedbackStats', () => {
    it('should get feedback statistics', async () => {
      // Mock additional data for stats
      mockPrisma.feedback.groupBy = jest.fn().mockResolvedValue([
        { rating: 5, _count: { rating: 10 } },
        { rating: 4, _count: { rating: 20 } },
        { rating: 3, _count: { rating: 15 } },
        { rating: 2, _count: { rating: 5 } },
        { rating: 1, _count: { rating: 2 } }
      ]);
      
      mockPrisma.feedback.count.mockResolvedValue(52);
      
      const result = await feedbackService.getFeedbackStats();
      
      expect(result).toEqual({
        totalCount: 52,
        averageRating: 3.6, // (5*10 + 4*20 + 3*15 + 2*5 + 1*2) / 52
        ratingDistribution: {
          '1': 2,
          '2': 5,
          '3': 15,
          '4': 20,
          '5': 10
        }
      });
      
      expect(mockPrisma.feedback.groupBy).toHaveBeenCalledWith({
        by: ['rating'],
        _count: {
          rating: true
        }
      });
      expect(mockPrisma.feedback.count).toHaveBeenCalled();
    });

    it('should apply filters when specified', async () => {
      // Mock additional data for stats
      mockPrisma.feedback.groupBy = jest.fn().mockResolvedValue([
        { rating: 5, _count: { rating: 5 } },
        { rating: 4, _count: { rating: 10 } }
      ]);
      
      mockPrisma.feedback.count.mockResolvedValue(15);
      
      const filters = {
        category: 'session',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };
      
      const result = await feedbackService.getFeedbackStats(filters);
      
      expect(result).toEqual({
        totalCount: 15,
        averageRating: 4.33, // (5*5 + 4*10) / 15
        ratingDistribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 10,
          '5': 5
        }
      });
      
      expect(mockPrisma.feedback.groupBy).toHaveBeenCalledWith({
        by: ['rating'],
        _count: {
          rating: true
        },
        where: {
          category: filters.category,
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        }
      });
      expect(mockPrisma.feedback.count).toHaveBeenCalledWith({
        where: {
          category: filters.category,
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.feedback.groupBy.mockRejectedValue(new Error('Database error'));
      
      await expect(feedbackService.getFeedbackStats())
        .rejects.toThrow('Failed to retrieve feedback statistics');
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving feedback statistics', {
        error: expect.any(Error)
      });
    });
  });
});
