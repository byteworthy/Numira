/**
 * Journal Controller
 * 
 * Handles HTTP requests related to journal entries.
 * Acts as a bridge between API routes and the journal service.
 */

const { validationResult } = require('express-validator');
const journalService = require('../services/journalService');
const logger = require('../utils/logger');

/**
 * Create a new journal entry
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function createJournal(req, res) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { personaId, roomId, prompt, response } = req.body;
    const userId = req.user.id;

    // Create journal entry
    const journal = await journalService.createJournalEntry(
      userId,
      personaId,
      roomId,
      prompt,
      response
    );

    // Return successful response
    return res.status(201).json({
      status: 'success',
      data: {
        journal
      },
      message: 'Journal entry created successfully',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error in createJournal controller', { error: error.message });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while creating journal entry'
    });
  }
}

/**
 * Get all journal entries for the authenticated user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function getUserJournals(req, res) {
  try {
    const userId = req.user.id;
    
    // Parse pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Get journal entries
    const result = await journalService.getUserJournals(userId, {
      limit,
      offset,
      sortBy,
      sortOrder
    });

    // Return successful response
    return res.json({
      status: 'success',
      data: {
        journals: result.journals,
        pagination: result.pagination
      },
      message: 'Journal entries retrieved successfully',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error in getUserJournals controller', { error: error.message });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving journal entries'
    });
  }
}

/**
 * Get a specific journal entry by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function getJournalById(req, res) {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // Get journal entry
    const journal = await journalService.getJournalById(journalId, userId);

    // Return successful response
    return res.json({
      status: 'success',
      data: {
        journal
      },
      message: 'Journal entry retrieved successfully',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    logger.error('Error in getJournalById controller', { error: error.message });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving journal entry'
    });
  }
}

/**
 * Delete a journal entry
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - JSON response
 */
async function deleteJournal(req, res) {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // Delete journal entry
    await journalService.deleteJournal(journalId, userId);

    // Return successful response
    return res.json({
      status: 'success',
      data: null,
      message: 'Journal entry deleted successfully',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    logger.error('Error in deleteJournal controller', { error: error.message });
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while deleting journal entry'
    });
  }
}

module.exports = {
  createJournal,
  getUserJournals,
  getJournalById,
  deleteJournal
};
