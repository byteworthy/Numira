/**
 * Unit Tests for Disclaimer Middleware
 */

const {
  default: disclaimerMiddleware,
  addDisclaimerHeader,
  standardizeResponse,
  addDisclaimerToResponse
} = require('../../../middleware/disclaimer');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('@prisma/client');

describe('Disclaimer Middleware', () => {
  let req, res, next, mockPrisma;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 10);

  beforeEach(() => {
    // Set up test doubles
    req = {
      user: {
        id: 'user123'
      },
      path: '/api/ai/chat'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      on: jest.fn()
    };
    next = jest.fn();

    // Mock console.error
    console.error = jest.fn();

    // Mock Prisma client
    mockPrisma = {
      user: {
        findUnique: jest.fn()
      }
    };

    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
  });

  describe('disclaimerMiddleware', () => {
    it('should return 401 if no user is authenticated', async () => {
      req.user = null;
      
      await disclaimerMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      await disclaimerMiddleware(req, res, next);
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
        select: {
          id: true,
          disclaimerAccepted: true,
          disclaimerAcceptedAt: true,
          disclaimerVersion: true
        }
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'User not found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user has not accepted disclaimer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        disclaimerAccepted: false,
        disclaimerAcceptedAt: null
      });
      
      await disclaimerMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'You must acknowledge the service disclaimers before using this feature',
        code: 'DISCLAIMER_REQUIRED',
        data: {
          redirectTo: '/disclaimer'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if disclaimer acceptance is expired', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        disclaimerAccepted: true,
        disclaimerAcceptedAt: ninetyDaysAgo
      });
      
      await disclaimerMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Your disclaimer acknowledgment has expired. Please review and acknowledge the updated terms.',
        code: 'DISCLAIMER_EXPIRED',
        data: {
          redirectTo: '/disclaimer',
          lastAccepted: ninetyDaysAgo
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user has accepted disclaimer recently', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        disclaimerAccepted: true,
        disclaimerAcceptedAt: recentDate
      });
      
      await disclaimerMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      await disclaimerMiddleware(req, res, next);
      
      expect(console.error).toHaveBeenCalledWith('Disclaimer middleware error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'An error occurred while checking disclaimer acknowledgment'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('addDisclaimerHeader', () => {
    it('should add disclaimer header to response', () => {
      addDisclaimerHeader(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Numira-Disclaimer',
        'This service is not a substitute for professional medical or mental health advice, diagnosis, or treatment.'
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('standardizeResponse', () => {
    it('should override res.json method', () => {
      const originalJson = res.json;
      
      standardizeResponse(req, res, next);
      
      expect(res.json).not.toBe(originalJson);
      expect(next).toHaveBeenCalled();
    });

    it('should wrap response in standard format for success', () => {
      const originalJson = res.json;
      res.statusCode = 200;
      
      standardizeResponse(req, res, next);
      res.json({ data: 'test' });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'success',
        data: { data: 'test' },
        message: 'Request successful'
      });
    });

    it('should wrap response in standard format for error', () => {
      const originalJson = res.json;
      res.statusCode = 400;
      
      standardizeResponse(req, res, next);
      res.json({ error: 'test error' });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'error',
        data: { error: 'test error' },
        message: 'An error occurred'
      });
    });

    it('should not modify response if already in standard format', () => {
      const originalJson = res.json;
      
      standardizeResponse(req, res, next);
      res.json({
        status: 'success',
        data: { result: 'test' },
        message: 'Custom message'
      });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'success',
        data: { result: 'test' },
        message: 'Custom message'
      });
    });
  });

  describe('addDisclaimerToResponse', () => {
    it('should override res.json method', () => {
      const originalJson = res.json;
      
      addDisclaimerToResponse(req, res, next);
      
      expect(res.json).not.toBe(originalJson);
      expect(next).toHaveBeenCalled();
    });

    it('should add disclaimer to AI-related responses', () => {
      const originalJson = res.json;
      req.path = '/api/ai/chat';
      
      addDisclaimerToResponse(req, res, next);
      res.json({
        status: 'success',
        data: { response: 'AI response' }
      });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'success',
        data: { response: 'AI response' },
        disclaimer: 'This service is not a substitute for professional medical or mental health advice, diagnosis, or treatment.'
      });
    });

    it('should not add disclaimer to non-AI-related responses', () => {
      const originalJson = res.json;
      req.path = '/api/users';
      
      addDisclaimerToResponse(req, res, next);
      res.json({
        status: 'success',
        data: { user: 'data' }
      });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'success',
        data: { user: 'data' }
      });
    });

    it('should not add disclaimer to error responses', () => {
      const originalJson = res.json;
      req.path = '/api/ai/chat';
      
      addDisclaimerToResponse(req, res, next);
      res.json({
        status: 'error',
        message: 'Error message'
      });
      
      expect(originalJson).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error message'
      });
    });
  });
});
