const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Service for handling user feedback operations
 */
class FeedbackService {
  /**
   * Create a new feedback entry
   * 
   * @param {Object} feedbackData - The feedback data
   * @param {string} feedbackData.message - The feedback message
   * @param {number} feedbackData.rating - The rating (1-5)
   * @param {string} [feedbackData.userId] - Optional user ID
   * @returns {Promise<Object>} The created feedback
   */
  async createFeedback(feedbackData) {
    try {
      const { message, rating, userId } = feedbackData;
      
      // Validate rating is between 1-5
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const feedback = await prisma.feedback.create({
        data: {
          message,
          rating,
          userId: userId || null
        }
      });

      logger.info(`Feedback created with ID: ${feedback.id}`);
      return feedback;
    } catch (error) {
      logger.error(`Error creating feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all feedback entries
   * 
   * @param {Object} options - Query options
   * @param {number} [options.limit=100] - Maximum number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @returns {Promise<Array>} List of feedback entries
   */
  async getAllFeedback(options = {}) {
    try {
      const { limit = 100, offset = 0 } = options;
      
      const feedback = await prisma.feedback.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      logger.info(`Retrieved ${feedback.length} feedback entries`);
      return feedback;
    } catch (error) {
      logger.error(`Error retrieving feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get feedback by ID
   * 
   * @param {string} id - The feedback ID
   * @returns {Promise<Object|null>} The feedback or null if not found
   */
  async getFeedbackById(id) {
    try {
      const feedback = await prisma.feedback.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      if (!feedback) {
        logger.warn(`Feedback with ID ${id} not found`);
        return null;
      }

      logger.info(`Retrieved feedback with ID: ${id}`);
      return feedback;
    } catch (error) {
      logger.error(`Error retrieving feedback by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get feedback statistics
   * 
   * @returns {Promise<Object>} Feedback statistics
   */
  async getFeedbackStats() {
    try {
      const totalCount = await prisma.feedback.count();
      
      // Calculate average rating
      const feedbackEntries = await prisma.feedback.findMany({
        select: { rating: true }
      });
      
      const totalRating = feedbackEntries.reduce((sum, entry) => sum + entry.rating, 0);
      const averageRating = totalCount > 0 ? totalRating / totalCount : 0;
      
      // Count by rating
      const ratingCounts = {};
      for (let i = 1; i <= 5; i++) {
        ratingCounts[i] = await prisma.feedback.count({
          where: { rating: i }
        });
      }

      logger.info('Retrieved feedback statistics');
      return {
        totalCount,
        averageRating,
        ratingCounts
      };
    } catch (error) {
      logger.error(`Error retrieving feedback statistics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new FeedbackService();
