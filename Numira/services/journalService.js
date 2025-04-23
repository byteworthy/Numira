/**
 * Journal Service
 * 
 * Handles operations related to user journal entries.
 * This service manages the creation and retrieval of journal entries
 * containing user prompts and AI responses.
 * 
 * SECURITY: Includes PHI detection to prevent storing personally identifiable health information
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const phiDetector = require('../utils/phiDetector');

// PHI detection is now handled by the centralized phiDetector utility

/**
 * Create a new journal entry
 * 
 * @param {string} userId - The user's ID
 * @param {string} personaId - The persona ID used for the conversation
 * @param {string} roomId - The room ID where the conversation took place
 * @param {string} prompt - The user's input/prompt
 * @param {string} response - The AI's response
 * @returns {Promise<Object>} - The created journal entry
 * @throws {Error} - If PHI is detected or parameters are missing
 */
async function createJournalEntry(userId, personaId, roomId, prompt, response) {
  try {
    // Validate inputs
    if (!userId || !personaId || !roomId || !prompt || !response) {
      throw new Error('Missing required parameters for journal entry');
    }
    
    // Check for PHI in prompt
    if (phiDetector.containsPHI(prompt)) {
      phiDetector.logPHIDetection('journalService', {
        userId,
        personaId,
        roomId
      });
      
      throw new Error(phiDetector.getPHIDetectionMessage('journal'));
    }
    
    // Sanitize inputs before storing
    const sanitizedPrompt = phiDetector.sanitizeInput(prompt);
    const sanitizedResponse = response; // Response is already sanitized by AI service
    
    // Create journal entry
    const journal = await prisma.journal.create({
      data: {
        userId,
        personaId,
        roomId,
        prompt: sanitizedPrompt,
        response: sanitizedResponse
      }
    });

    logger.info('Journal entry created', { 
      journalId: journal.id, 
      userId, 
      personaId, 
      roomId 
    });

    return journal;
  } catch (error) {
    logger.error('Error creating journal entry', { 
      error: error.message, 
      userId, 
      personaId, 
      roomId 
    });
    throw error;
  }
}

/**
 * Get all journal entries for a user
 * 
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of entries to return
 * @param {number} options.offset - Number of entries to skip
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc')
 * @returns {Promise<Array>} - Array of journal entries
 */
async function getUserJournals(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Validate user ID
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get journal entries
    const journals = await prisma.journal.findMany({
      where: {
        userId
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.journal.count({
      where: {
        userId
      }
    });

    return {
      journals,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + journals.length < totalCount
      }
    };
  } catch (error) {
    logger.error('Error retrieving user journals', { 
      error: error.message, 
      userId 
    });
    throw error;
  }
}

/**
 * Get a specific journal entry by ID
 * 
 * @param {string} journalId - The journal entry ID
 * @param {string} userId - The user's ID (for authorization)
 * @returns {Promise<Object>} - The journal entry
 */
async function getJournalById(journalId, userId) {
  try {
    // Validate inputs
    if (!journalId || !userId) {
      throw new Error('Journal ID and User ID are required');
    }

    // Get journal entry
    const journal = await prisma.journal.findUnique({
      where: {
        id: journalId
      }
    });

    // Check if journal exists
    if (!journal) {
      throw new Error('Journal entry not found');
    }

    // Check if journal belongs to user
    if (journal.userId !== userId) {
      throw new Error('Unauthorized access to journal entry');
    }

    return journal;
  } catch (error) {
    logger.error('Error retrieving journal entry', { 
      error: error.message, 
      journalId, 
      userId 
    });
    throw error;
  }
}

/**
 * Delete a journal entry
 * 
 * @param {string} journalId - The journal entry ID
 * @param {string} userId - The user's ID (for authorization)
 * @returns {Promise<Object>} - The deleted journal entry
 */
async function deleteJournal(journalId, userId) {
  try {
    // Validate inputs
    if (!journalId || !userId) {
      throw new Error('Journal ID and User ID are required');
    }

    // Check if journal exists and belongs to user
    const journal = await prisma.journal.findUnique({
      where: {
        id: journalId
      }
    });

    if (!journal) {
      throw new Error('Journal entry not found');
    }

    if (journal.userId !== userId) {
      throw new Error('Unauthorized access to journal entry');
    }

    // Delete journal entry
    const deletedJournal = await prisma.journal.delete({
      where: {
        id: journalId
      }
    });

    logger.info('Journal entry deleted', { 
      journalId, 
      userId 
    });

    return deletedJournal;
  } catch (error) {
    logger.error('Error deleting journal entry', { 
      error: error.message, 
      journalId, 
      userId 
    });
    throw error;
  }
}

module.exports = {
  createJournalEntry,
  getUserJournals,
  getJournalById,
  deleteJournal
};
