const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const userDeletionService = require('../../services/userDeletionService');
const queueService = require('../../services/queueService');

/**
 * @route   GET /api/account
 * @desc    Get user account information
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            id: true,
            status: true,
            plan: true,
            expiresAt: true
          }
        },
        settings: true,
        familyPlan: {
          select: {
            id: true,
            role: true,
            family: {
              select: {
                id: true,
                name: true,
                ownerId: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching account information', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /api/account
 * @desc    Update user account information
 * @access  Private
 */
router.put('/', [
  auth,
  check('firstName', 'First name is required').optional().notEmpty(),
  check('lastName', 'Last name is required').optional().notEmpty(),
  check('email', 'Please include a valid email').optional().isEmail(),
  check('settings', 'Settings must be an object').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, email, settings } = req.body;

  try {
    // Build update object
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) {
      // Check if email is already in use
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      updateData.email = email;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Update settings if provided
    if (settings) {
      await prisma.userSettings.upsert({
        where: { userId: req.user.id },
        update: settings,
        create: {
          ...settings,
          userId: req.user.id
        }
      });
    }

    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating account information', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/', auth, async (req, res) => {
  try {
    // Get retention period from environment or use default (30 days)
    const retentionDays = parseInt(process.env.ACCOUNT_DELETION_RETENTION_DAYS || '30', 10);
    
    // Schedule account for deletion
    await userDeletionService.scheduleAccountDeletion(req.user.id, retentionDays);
    
    // Log the deletion request
    logger.info('Account deletion requested', { 
      userId: req.user.id, 
      retentionDays,
      deletionDate: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
    });

    // Queue an email notification about the account deletion
    await queueService.addEmailJob({
      to: req.user.email,
      subject: 'Your Numira Account Deletion Request',
      html: `
        <h1>Account Deletion Request Received</h1>
        <p>Hello ${req.user.firstName || 'there'},</p>
        <p>We've received your request to delete your Numira account. Your account has been scheduled for deletion.</p>
        <p>Your account and data will be permanently deleted after ${retentionDays} days. During this period, you can log back in to cancel the deletion process.</p>
        <p>If you have any questions or need assistance, please contact our support team at support@numira.app.</p>
        <p>Thank you for using Numira.</p>
      `,
      text: `
        Account Deletion Request Received
        
        Hello ${req.user.firstName || 'there'},
        
        We've received your request to delete your Numira account. Your account has been scheduled for deletion.
        
        Your account and data will be permanently deleted after ${retentionDays} days. During this period, you can log back in to cancel the deletion process.
        
        If you have any questions or need assistance, please contact our support team at support@numira.app.
        
        Thank you for using Numira.
      `
    });

    res.json({ 
      message: 'Account scheduled for deletion', 
      retentionDays,
      deletionDate: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    logger.error('Error scheduling account deletion', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/account/cancel-deletion
 * @desc    Cancel account deletion
 * @access  Private
 */
router.post('/cancel-deletion', auth, async (req, res) => {
  try {
    // Cancel the scheduled deletion
    const result = await userDeletionService.cancelAccountDeletion(req.user.id);
    
    if (!result) {
      return res.status(400).json({ error: 'No deletion scheduled for this account' });
    }
    
    // Log the cancellation
    logger.info('Account deletion cancelled', { userId: req.user.id });

    // Queue an email notification about the cancellation
    await queueService.addEmailJob({
      to: req.user.email,
      subject: 'Your Numira Account Deletion Cancelled',
      html: `
        <h1>Account Deletion Cancelled</h1>
        <p>Hello ${req.user.firstName || 'there'},</p>
        <p>We've cancelled the scheduled deletion of your Numira account. Your account and data will remain intact.</p>
        <p>If you have any questions or need assistance, please contact our support team at support@numira.app.</p>
        <p>Thank you for continuing to use Numira.</p>
      `,
      text: `
        Account Deletion Cancelled
        
        Hello ${req.user.firstName || 'there'},
        
        We've cancelled the scheduled deletion of your Numira account. Your account and data will remain intact.
        
        If you have any questions or need assistance, please contact our support team at support@numira.app.
        
        Thank you for continuing to use Numira.
      `
    });

    res.json({ message: 'Account deletion cancelled' });
  } catch (error) {
    logger.error('Error cancelling account deletion', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/account/deletion-status
 * @desc    Get account deletion status
 * @access  Private
 */
router.get('/deletion-status', auth, async (req, res) => {
  try {
    const status = await userDeletionService.getAccountDeletionStatus(req.user.id);
    res.json(status);
  } catch (error) {
    logger.error('Error getting account deletion status', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
