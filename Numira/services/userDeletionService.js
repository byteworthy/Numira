const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const queueService = require('./queueService');

/**
 * Service for handling user account deletion
 */
const userDeletionService = {
  /**
   * Schedule an account for deletion
   * @param {string} userId - User ID
   * @param {number} retentionDays - Number of days to retain the account before deletion
   * @returns {Promise<Object>} - Scheduled deletion information
   */
  async scheduleAccountDeletion(userId, retentionDays = 30) {
    try {
      // Calculate deletion date
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + retentionDays);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if deletion is already scheduled
      const existingSchedule = await prisma.accountDeletion.findUnique({
        where: { userId }
      });

      if (existingSchedule) {
        // Update existing schedule
        const updated = await prisma.accountDeletion.update({
          where: { userId },
          data: {
            scheduledDate: deletionDate,
            status: 'SCHEDULED',
            updatedAt: new Date()
          }
        });

        logger.info('Updated account deletion schedule', { 
          userId, 
          deletionDate: deletionDate.toISOString() 
        });

        return updated;
      }

      // Create new deletion schedule
      const schedule = await prisma.accountDeletion.create({
        data: {
          userId,
          scheduledDate: deletionDate,
          status: 'SCHEDULED',
          reason: 'USER_REQUESTED'
        }
      });

      // Schedule the actual deletion job
      await queueService.addCleanupJob({
        type: 'account-deletion',
        userId,
        scheduledDate: deletionDate.toISOString()
      }, {
        delay: retentionDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60 * 1000 // 1 minute
        }
      });

      logger.info('Scheduled account for deletion', { 
        userId, 
        deletionDate: deletionDate.toISOString() 
      });

      return schedule;
    } catch (error) {
      logger.error('Error scheduling account deletion', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  },

  /**
   * Cancel a scheduled account deletion
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - True if cancellation was successful
   */
  async cancelAccountDeletion(userId) {
    try {
      // Check if deletion is scheduled
      const existingSchedule = await prisma.accountDeletion.findUnique({
        where: { userId }
      });

      if (!existingSchedule || existingSchedule.status !== 'SCHEDULED') {
        return false;
      }

      // Update deletion status
      await prisma.accountDeletion.update({
        where: { userId },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      // Remove the scheduled job
      // Note: This is a best-effort attempt, as the job might have already been processed
      await queueService.cleanupQueue.removeJobs(`account-deletion:${userId}`);

      logger.info('Cancelled account deletion', { userId });

      return true;
    } catch (error) {
      logger.error('Error cancelling account deletion', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  },

  /**
   * Get account deletion status
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - Deletion status or null if not scheduled
   */
  async getAccountDeletionStatus(userId) {
    try {
      const deletionStatus = await prisma.accountDeletion.findUnique({
        where: { userId },
        select: {
          status: true,
          scheduledDate: true,
          reason: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return deletionStatus || { status: 'NOT_SCHEDULED' };
    } catch (error) {
      logger.error('Error getting account deletion status', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  },

  /**
   * Execute account deletion
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - True if deletion was successful
   */
  async executeAccountDeletion(userId) {
    try {
      // Check if deletion is scheduled and due
      const deletionRecord = await prisma.accountDeletion.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!deletionRecord || deletionRecord.status !== 'SCHEDULED') {
        logger.warn('Attempted to delete account with no valid schedule', { userId });
        return false;
      }

      const now = new Date();
      if (deletionRecord.scheduledDate > now) {
        logger.warn('Attempted to delete account before scheduled date', { 
          userId, 
          scheduledDate: deletionRecord.scheduledDate.toISOString(),
          currentDate: now.toISOString()
        });
        return false;
      }

      // Start a transaction to ensure all related data is deleted
      await prisma.$transaction(async (tx) => {
        // Update deletion status to IN_PROGRESS
        await tx.accountDeletion.update({
          where: { userId },
          data: {
            status: 'IN_PROGRESS',
            updatedAt: now
          }
        });

        // Delete user data in the correct order to respect foreign key constraints
        
        // 1. Delete conversations and messages
        await tx.message.deleteMany({
          where: {
            conversation: {
              userId
            }
          }
        });

        await tx.conversation.deleteMany({
          where: { userId }
        });

        // 2. Delete insights
        await tx.insight.deleteMany({
          where: { userId }
        });

        // 3. Delete subscription data
        await tx.subscription.deleteMany({
          where: { userId }
        });

        // 4. Delete family plan memberships
        await tx.familyMember.deleteMany({
          where: { userId }
        });

        // 5. Delete user settings
        await tx.userSettings.deleteMany({
          where: { userId }
        });

        // 6. Delete user notifications
        await tx.notification.deleteMany({
          where: { userId }
        });

        // 7. Delete user feedback
        await tx.feedback.deleteMany({
          where: { userId }
        });

        // 8. Delete user sessions
        await tx.session.deleteMany({
          where: { userId }
        });

        // 9. Update deletion record to COMPLETED
        await tx.accountDeletion.update({
          where: { userId },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            updatedAt: now
          }
        });

        // 10. Finally, delete or anonymize the user
        // Option 1: Complete deletion
        // await tx.user.delete({
        //   where: { id: userId }
        // });

        // Option 2: Anonymize user (GDPR compliant approach)
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted-${userId}@example.com`,
            firstName: 'Deleted',
            lastName: 'User',
            password: null, // Prevent login
            isActive: false,
            deletedAt: now
          }
        });
      });

      logger.info('Successfully deleted user account', { userId });
      return true;
    } catch (error) {
      logger.error('Error executing account deletion', { 
        error: error.message, 
        stack: error.stack,
        userId 
      });

      // Update deletion status to FAILED
      try {
        await prisma.accountDeletion.update({
          where: { userId },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        });
      } catch (updateError) {
        logger.error('Error updating deletion status after failure', { 
          error: updateError.message, 
          userId 
        });
      }

      throw error;
    }
  },

  /**
   * Process pending account deletions
   * @returns {Promise<number>} - Number of accounts processed
   */
  async processPendingDeletions() {
    try {
      // Find accounts scheduled for deletion that are past their scheduled date
      const pendingDeletions = await prisma.accountDeletion.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledDate: {
            lte: new Date()
          }
        },
        select: {
          userId: true
        }
      });

      logger.info(`Found ${pendingDeletions.length} pending account deletions`);

      let successCount = 0;
      let failureCount = 0;

      // Process each deletion
      for (const deletion of pendingDeletions) {
        try {
          const success = await this.executeAccountDeletion(deletion.userId);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          logger.error('Error processing account deletion', { 
            error: error.message, 
            userId: deletion.userId 
          });
        }
      }

      logger.info('Completed processing pending account deletions', { 
        total: pendingDeletions.length,
        success: successCount,
        failure: failureCount
      });

      return successCount;
    } catch (error) {
      logger.error('Error processing pending account deletions', { 
        error: error.message 
      });
      throw error;
    }
  }
};

module.exports = userDeletionService;
