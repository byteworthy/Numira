/**
 * Terms API Routes
 * 
 * Provides endpoints to get and accept terms of service.
 */

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const logger = require('../../utils/logger');
const { validateInput, schemas } = require('../../middleware/validateInput');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { z } = require('zod');

/**
 * @route   GET /api/terms/latest
 * @desc    Get the latest terms of service
 * @access  Public
 */
router.get('/latest', async (req, res) => {
  try {
    // Get the latest active terms
    const latestTerms = await prisma.termsOfService.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' }
    });
    
    if (!latestTerms) {
      return res.status(404).json({
        status: 'error',
        message: 'No active terms of service found',
        data: null
      });
    }
    
    // Check if user has accepted these terms
    let userAcceptance = null;
    if (req.user) {
      userAcceptance = await prisma.userTermsAcceptance.findFirst({
        where: {
          userId: req.user.id,
          termsOfServiceId: latestTerms.id
        }
      });
    }
    
    res.json({
      status: 'success',
      data: {
        id: latestTerms.id,
        version: latestTerms.version,
        content: latestTerms.content,
        effectiveDate: latestTerms.effectiveDate,
        isActive: latestTerms.isActive,
        createdAt: latestTerms.createdAt,
        accepted: !!userAcceptance,
        acceptedAt: userAcceptance ? userAcceptance.acceptedAt : null
      }
    });
  } catch (error) {
    logger.error('Error getting latest terms', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * @route   GET /api/terms/:id
 * @desc    Get a specific terms of service by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the terms by ID
    const terms = await prisma.termsOfService.findUnique({
      where: { id }
    });
    
    if (!terms) {
      return res.status(404).json({
        status: 'error',
        message: 'Terms of service not found',
        data: null
      });
    }
    
    // Check if user has accepted these terms
    let userAcceptance = null;
    if (req.user) {
      userAcceptance = await prisma.userTermsAcceptance.findFirst({
        where: {
          userId: req.user.id,
          termsOfServiceId: terms.id
        }
      });
    }
    
    res.json({
      status: 'success',
      data: {
        id: terms.id,
        version: terms.version,
        content: terms.content,
        effectiveDate: terms.effectiveDate,
        isActive: terms.isActive,
        createdAt: terms.createdAt,
        accepted: !!userAcceptance,
        acceptedAt: userAcceptance ? userAcceptance.acceptedAt : null
      }
    });
  } catch (error) {
    logger.error('Error getting terms', { 
      id: req.params.id,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * @route   GET /api/terms/history
 * @desc    Get terms of service history
 * @access  Private (Admin)
 */
router.get('/history', [auth, roleCheck(['admin'])], async (req, res) => {
  try {
    // Get all terms versions
    const termsHistory = await prisma.termsOfService.findMany({
      orderBy: { version: 'desc' }
    });
    
    res.json({
      status: 'success',
      data: termsHistory
    });
  } catch (error) {
    logger.error('Error getting terms history', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * @route   GET /api/terms/user
 * @desc    Get user's terms acceptance history
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's terms acceptance history
    const userTerms = await prisma.userTermsAcceptance.findMany({
      where: { userId },
      include: { termsOfService: true },
      orderBy: { acceptedAt: 'desc' }
    });
    
    res.json({
      status: 'success',
      data: userTerms.map(ut => ({
        id: ut.id,
        termsId: ut.termsOfServiceId,
        termsVersion: ut.termsOfService.version,
        acceptedAt: ut.acceptedAt,
        acceptedFrom: ut.acceptedFrom,
        ipAddress: ut.ipAddress
      }))
    });
  } catch (error) {
    logger.error('Error getting user terms history', { 
      userId: req.user.id,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * Terms acceptance schema
 */
const acceptTermsSchema = {
  body: {
    termsId: z.string().uuid(),
    acceptedFrom: z.string().optional()
  }
};

/**
 * @route   POST /api/terms/accept
 * @desc    Accept terms of service
 * @access  Private
 */
router.post('/accept', [
  auth,
  validateInput(acceptTermsSchema)
], async (req, res) => {
  try {
    const { termsId, acceptedFrom = 'app' } = req.body;
    const userId = req.user.id;
    
    // Check if terms exist
    const terms = await prisma.termsOfService.findUnique({
      where: { id: termsId }
    });
    
    if (!terms) {
      return res.status(404).json({
        status: 'error',
        message: 'Terms of service not found',
        data: null
      });
    }
    
    // Check if user has already accepted these terms
    const existingAcceptance = await prisma.userTermsAcceptance.findFirst({
      where: {
        userId,
        termsOfServiceId: termsId
      }
    });
    
    if (existingAcceptance) {
      return res.json({
        status: 'success',
        message: 'Terms already accepted',
        data: {
          id: existingAcceptance.id,
          termsId: existingAcceptance.termsOfServiceId,
          acceptedAt: existingAcceptance.acceptedAt
        }
      });
    }
    
    // Record terms acceptance
    const userTerms = await prisma.userTermsAcceptance.create({
      data: {
        userId,
        termsOfServiceId: termsId,
        acceptedFrom,
        ipAddress: req.ip
      }
    });
    
    // Log the terms acceptance
    logger.info('User accepted terms of service', {
      userId,
      termsId,
      termsVersion: terms.version
    });
    
    res.json({
      status: 'success',
      message: 'Terms accepted successfully',
      data: {
        id: userTerms.id,
        termsId: userTerms.termsOfServiceId,
        acceptedAt: userTerms.acceptedAt
      }
    });
  } catch (error) {
    logger.error('Error accepting terms', { 
      userId: req.user.id,
      termsId: req.body.termsId,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * Terms creation schema
 */
const createTermsSchema = {
  body: {
    version: z.string(),
    content: z.string(),
    effectiveDate: z.string().datetime(),
    isActive: z.boolean().optional()
  }
};

/**
 * @route   POST /api/terms
 * @desc    Create new terms of service
 * @access  Private (Admin)
 */
router.post('/', [
  auth,
  roleCheck(['admin']),
  validateInput(createTermsSchema)
], async (req, res) => {
  try {
    const { version, content, effectiveDate, isActive = true } = req.body;
    
    // If new terms are active, deactivate all other terms
    if (isActive) {
      await prisma.termsOfService.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }
    
    // Create new terms
    const terms = await prisma.termsOfService.create({
      data: {
        version,
        content,
        effectiveDate: new Date(effectiveDate),
        isActive
      }
    });
    
    // Log the terms creation
    logger.info('New terms of service created', {
      termsId: terms.id,
      version,
      isActive
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Terms of service created successfully',
      data: terms
    });
  } catch (error) {
    logger.error('Error creating terms', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

/**
 * Terms update schema
 */
const updateTermsSchema = {
  params: schemas.idParam.params,
  body: {
    content: z.string().optional(),
    effectiveDate: z.string().datetime().optional(),
    isActive: z.boolean().optional()
  }
};

/**
 * @route   PUT /api/terms/:id
 * @desc    Update terms of service
 * @access  Private (Admin)
 */
router.put('/:id', [
  auth,
  roleCheck(['admin']),
  validateInput(updateTermsSchema)
], async (req, res) => {
  try {
    const { id } = req.params;
    const { content, effectiveDate, isActive } = req.body;
    
    // Check if terms exist
    const existingTerms = await prisma.termsOfService.findUnique({
      where: { id }
    });
    
    if (!existingTerms) {
      return res.status(404).json({
        status: 'error',
        message: 'Terms of service not found',
        data: null
      });
    }
    
    // If updating to active, deactivate all other terms
    if (isActive) {
      await prisma.termsOfService.updateMany({
        where: { 
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      });
    }
    
    // Update terms
    const terms = await prisma.termsOfService.update({
      where: { id },
      data: {
        content: content !== undefined ? content : undefined,
        effectiveDate: effectiveDate !== undefined ? new Date(effectiveDate) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });
    
    // Log the terms update
    logger.info('Terms of service updated', {
      termsId: terms.id,
      version: terms.version,
      isActive: terms.isActive
    });
    
    res.json({
      status: 'success',
      message: 'Terms of service updated successfully',
      data: terms
    });
  } catch (error) {
    logger.error('Error updating terms', { 
      id: req.params.id,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      data: null
    });
  }
});

module.exports = router;
