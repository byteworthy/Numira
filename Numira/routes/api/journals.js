/**
 * Journal API Routes
 * 
 * Provides endpoints for managing user journal entries.
 * 
 * SECURITY: All routes are protected by authentication and disclaimer acceptance.
 * PHI detection is enforced at the service level.
 * 
 * @swagger
 * tags:
 *   name: Journals
 *   description: Journal entry management endpoints
 * 
 * @swagger
 * components:
 *   schemas:
 *     Journal:
 *       type: object
 *       required:
 *         - personaId
 *         - roomId
 *         - prompt
 *         - response
 *       properties:
 *         id:
 *           type: string
 *           description: The journal entry ID
 *         userId:
 *           type: string
 *           description: The user ID who owns this journal entry
 *         personaId:
 *           type: string
 *           description: The persona ID used for this conversation
 *         roomId:
 *           type: string
 *           description: The room ID where the conversation took place
 *         prompt:
 *           type: string
 *           description: The user's input/prompt
 *         response:
 *           type: string
 *           description: The AI's response
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the journal entry was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the journal entry was last updated
 *       example:
 *         id: "60d21b4667d0d8992e610c85"
 *         userId: "60d0fe4f5311236168a109ca"
 *         personaId: "rumi"
 *         roomId: "mirrorRoom"
 *         prompt: "I've been feeling anxious about my upcoming presentation"
 *         response: "It sounds like you're experiencing some anticipatory anxiety, which is very common. Let's explore some ways to prepare and manage these feelings..."
 *         createdAt: "2023-06-21T15:24:18.957Z"
 *         updatedAt: "2023-06-21T15:24:18.957Z"
 */

const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { 
  createJournal, 
  getUserJournals, 
  getJournalById, 
  deleteJournal 
} = require('../../controllers/journalController');
const auth = require('../../middleware/auth');
const disclaimer = require('../../middleware/disclaimer').default;

/**
 * @route   POST /api/journals
 * @desc    Create a new journal entry
 * @access  Private (requires disclaimer acceptance)
 * 
 * @swagger
 * /api/journals:
 *   post:
 *     summary: Create a new journal entry
 *     tags: [Journals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - personaId
 *               - roomId
 *               - prompt
 *               - response
 *             properties:
 *               personaId:
 *                 type: string
 *                 description: The persona ID used for this conversation
 *               roomId:
 *                 type: string
 *                 description: The room ID where the conversation took place
 *               prompt:
 *                 type: string
 *                 description: The user's input/prompt
 *               response:
 *                 type: string
 *                 description: The AI's response
 *             example:
 *               personaId: "rumi"
 *               roomId: "mirrorRoom"
 *               prompt: "I've been feeling anxious about my upcoming presentation"
 *               response: "It sounds like you're experiencing some anticipatory anxiety, which is very common. Let's explore some ways to prepare and manage these feelings..."
 *     responses:
 *       201:
 *         description: Journal entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Journal'
 *       400:
 *         description: Invalid input or PHI detected
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Disclaimer not accepted
 *       500:
 *         description: Server error
 */
router.post('/', [
  auth, // Require authentication
  disclaimer, // Require disclaimer acceptance
  
  // Input validation
  check('personaId', 'Persona ID is required').notEmpty().trim(),
  check('roomId', 'Room ID is required').notEmpty().trim(),
  check('prompt', 'Prompt is required').notEmpty(),
  check('response', 'Response is required').notEmpty(),
  
  // Sanitize inputs
  check('personaId').escape(),
  check('roomId').escape()
], createJournal);

/**
 * @route   GET /api/journals
 * @desc    Get all journal entries for the authenticated user
 * @access  Private (requires disclaimer acceptance)
 * 
 * @swagger
 * /api/journals:
 *   get:
 *     summary: Get all journal entries for the authenticated user
 *     tags: [Journals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of entries to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of entries to skip
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: List of journal entries
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
 *                     journals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Journal'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 42
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         offset:
 *                           type: integer
 *                           example: 0
 *                         hasMore:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Disclaimer not accepted
 *       500:
 *         description: Server error
 */
router.get('/', [auth, disclaimer], getUserJournals);

/**
 * @route   GET /api/journals/:id
 * @desc    Get a specific journal entry by ID
 * @access  Private (requires disclaimer acceptance)
 * 
 * @swagger
 * /api/journals/{id}:
 *   get:
 *     summary: Get a specific journal entry by ID
 *     tags: [Journals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Journal entry ID
 *     responses:
 *       200:
 *         description: Journal entry found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Journal'
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Disclaimer not accepted or unauthorized access
 *       404:
 *         description: Journal entry not found
 *       500:
 *         description: Server error
 */
router.get('/:id', [auth, disclaimer], getJournalById);

/**
 * @route   DELETE /api/journals/:id
 * @desc    Delete a journal entry
 * @access  Private (requires disclaimer acceptance)
 * 
 * @swagger
 * /api/journals/{id}:
 *   delete:
 *     summary: Delete a journal entry
 *     tags: [Journals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Journal entry ID
 *     responses:
 *       200:
 *         description: Journal entry deleted
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
 *                     message:
 *                       type: string
 *                       example: "Journal entry deleted successfully"
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Disclaimer not accepted or unauthorized access
 *       404:
 *         description: Journal entry not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', [auth, disclaimer], deleteJournal);

module.exports = router;
