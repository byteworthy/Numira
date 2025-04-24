const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const feedbackController = require('../../controllers/feedbackController');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: User feedback management
 */

/**
 * @swagger
 * /api/feedback/health:
 *   get:
 *     summary: Health check for feedback API
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: API is operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Feedback API is operational
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  logger.info('Feedback API health check');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Feedback API is operational',
    timestamp: new Date().toISOString() 
  });
});

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit new feedback
 *     tags: [Feedback]
 *     description: Submit user feedback with a message and rating (1-5 stars)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - rating
 *             properties:
 *               message:
 *                 type: string
 *                 description: Feedback message
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5 stars
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', [
  check('message', 'Message is required').not().isEmpty(),
  check('rating', 'Rating must be a number between 1 and 5').isInt({ min: 1, max: 5 })
], feedbackController.submitFeedback);

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Get all feedback entries
 *     tags: [Feedback]
 *     description: Retrieve all feedback entries (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of feedback entries to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of feedback entries to skip
 *     responses:
 *       200:
 *         description: List of feedback entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Feedback'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       500:
 *         description: Server error
 */
router.get('/', [auth, roleCheck('admin')], feedbackController.getAllFeedback);

/**
 * @swagger
 * /api/feedback/stats:
 *   get:
 *     summary: Get feedback statistics
 *     tags: [Feedback]
 *     description: Retrieve statistics about feedback (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 150
 *                     averageRating:
 *                       type: number
 *                       format: float
 *                       example: 4.2
 *                     ratingCounts:
 *                       type: object
 *                       properties:
 *                         "1":
 *                           type: integer
 *                           example: 5
 *                         "2":
 *                           type: integer
 *                           example: 10
 *                         "3":
 *                           type: integer
 *                           example: 25
 *                         "4":
 *                           type: integer
 *                           example: 50
 *                         "5":
 *                           type: integer
 *                           example: 60
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       500:
 *         description: Server error
 */
router.get('/stats', [auth, roleCheck('admin')], feedbackController.getFeedbackStats);

/**
 * @swagger
 * /api/feedback/{id}:
 *   get:
 *     summary: Get feedback by ID
 *     tags: [Feedback]
 *     description: Retrieve a specific feedback entry by ID (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       200:
 *         description: Feedback entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Feedback'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Server error
 */
router.get('/:id', [auth, roleCheck('admin')], feedbackController.getFeedbackById);

module.exports = router;
