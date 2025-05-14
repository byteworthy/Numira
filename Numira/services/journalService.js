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
 * Get all journal entries for a user with optimized pagination
 * 
 * @param {string} userId - The user's ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of entries to return
 * @param {number} options.offset - Number of entries to skip
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc')
 * @param {string} options.personaId - Filter by persona ID (optional)
 * @param {string} options.roomId - Filter by room ID (optional)
 * @param {string} options.searchTerm - Search in prompt and response (optional)
 * @returns {Promise<Object>} - Object containing journals and pagination info
 */
async function getUserJournals(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      personaId,
      roomId,
      searchTerm
    } = options;

    // Validate user ID
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Build where clause with filters
    const where = { userId };
    
    // Add optional filters
    if (personaId) {
      where.personaId = personaId;
    }
    
    if (roomId) {
      where.roomId = roomId;
    }
    
    // Add search term if provided
    if (searchTerm) {
      where.OR = [
        { prompt: { contains: searchTerm, mode: 'insensitive' } },
        { response: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Use a single query with count for better performance
    // This avoids the N+1 query problem by getting both data and count in one go
    const [journals, totalCount] = await prisma.$transaction([
      prisma.journal.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: offset,
        take: limit,
        // Select only needed fields to reduce data transfer
        select: {
          id: true,
          userId: true,
          personaId: true,
          roomId: true,
          prompt: true,
          response: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.journal.count({ where })
    ]);

    // Calculate pagination info
    const hasMore = offset + journals.length < totalCount;

    return {
      journals,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    logger.error('Error retrieving user journals', { 
      error: error.message, 
      userId,
      options
    });
    throw error;
  }
}

/**
 * Get a specific journal entry by ID with optimized security checks
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

    // Get journal entry with combined security check
    // This is more efficient as it combines the lookup and security check in one query
    const journal = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId // This ensures we only get the journal if it belongs to the user
      }
    });

    // Check if journal exists
    if (!journal) {
      // This error message is intentionally vague for security
      // It doesn't reveal whether the journal exists but belongs to someone else
      throw new Error('Journal entry not found or access denied');
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
 * Delete a journal entry with optimized security checks
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

    // Use a transaction to ensure atomicity and optimize the operation
    // This combines the security check and deletion in a single atomic operation
    const deletedJournal = await prisma.$transaction(async (tx) => {
      // First, find the journal with ownership check
      const journal = await tx.journal.findFirst({
        where: {
          id: journalId,
          userId // This ensures we only get the journal if it belongs to the user
        }
      });

      // If journal doesn't exist or doesn't belong to user
      if (!journal) {
        throw new Error('Journal entry not found or access denied');
      }

      // Delete the journal entry
      return tx.journal.delete({
        where: {
          id: journalId
        }
      });
    });

    logger.info('Journal entry deleted successfully', { 
      journalId, 
      userId 
    });

    return deletedJournal;
  } catch (error) {
    // Check for specific error types
    if (error.code === 'P2025') {
      // Prisma error for record not found
      logger.warn('Attempted to delete non-existent journal entry', {
        journalId,
        userId
      });
      throw new Error('Journal entry not found');
    }
    
    logger.error('Error deleting journal entry', { 
      error: error.message,
      errorCode: error.code,
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
