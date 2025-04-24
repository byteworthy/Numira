const feedbackService = require('../services/feedbackService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     Feedback:
 *       type: object
 *       required:
 *         - message
 *         - rating
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the feedback
 *         message:
 *           type: string
 *           description: The feedback message
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Rating from 1 to 5 stars
 *         userId:
 *           type: string
 *           description: ID of the user who submitted the feedback (optional)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the feedback was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the feedback was last updated
 *       example:
 *         id: 60d21b4667d0d8992e610c85
 *         message: The app is very intuitive and helpful
 *         rating: 5
 *         userId: 60d21b4667d0d8992e610c80
 *         createdAt: 2023-04-23T18:25:43.511Z
 *         updatedAt: 2023-04-23T18:25:43.511Z
 */

/**
 * Submit new feedback
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response
 */
exports.submitFeedback = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, rating } = req.body;
    const userId = req.user ? req.user.id : null;

    const feedback = await feedbackService.createFeedback({
      message,
      rating,
      userId
    });

    logger.info(`Feedback submitted successfully with ID: ${feedback.id}`);
    return res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    logger.error(`Error submitting feedback: ${error.message}`);
    if (error.message === 'Rating must be between 1 and 5') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
};

/**
 * Get all feedback entries
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response
 */
exports.getAllFeedback = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const feedback = await feedbackService.getAllFeedback({ limit, offset });

    logger.info(`Retrieved ${feedback.length} feedback entries`);
    return res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback
    });
  } catch (error) {
    logger.error(`Error retrieving feedback: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving feedback'
    });
  }
};

/**
 * Get feedback by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response
 */
exports.getFeedbackById = async (req, res) => {
  try {
    const feedback = await feedbackService.getFeedbackById(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    logger.info(`Retrieved feedback with ID: ${req.params.id}`);
    return res.status(200).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    logger.error(`Error retrieving feedback by ID: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving feedback'
    });
  }
};

/**
 * Get feedback statistics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response
 */
exports.getFeedbackStats = async (req, res) => {
  try {
    const stats = await feedbackService.getFeedbackStats();

    logger.info('Retrieved feedback statistics');
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error retrieving feedback statistics: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving feedback statistics'
    });
  }
};
