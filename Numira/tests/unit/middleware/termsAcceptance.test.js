/**
 * Unit Tests for Terms Acceptance Middleware
 */

const {
  requireTermsAcceptance,
  requireTermsAcceptanceForApi,
  requireTermsAcceptanceForWeb,
  skipTermsAcceptanceForRoles
} = require('../../../middleware/termsAcceptance');

const logger = require('../../../utils/logger');

jest.mock('@prisma/client');
jest.mock('../../../utils/logger');

describe('Terms Acceptance Middleware', () => {
  let req, res, next, mockPrisma;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 10);

  beforeEach(() => {
    // Set up test doubles
    req = {
      user: {
        id: 'user123',
        role: 'user'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      send: jest.fn()
    };
    
    next = jest.fn();
    
    // Mock Prisma client
    mockPrisma = {
      termsOfService: {
        findFirst: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      userTermsAcceptance: {
        findFirst: jest.fn()
      }
    };
    
    // Set up the mock implementation of PrismaClient
    const { PrismaClient } = require('@prisma/client');
    PrismaClient.mockImplementation(() => mockPrisma);
  });

  describe('requireTermsAcceptance', () => {
    it('should return a middleware function', () => {
      const middleware = requireTermsAcceptance();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware takes (req, res, next)
    });

    it('should call next() if no user is authenticated', async () => {
      req.user = null;
      const middleware = requireTermsAcceptance();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(mockPrisma.termsOfService.findFirst).not.toHaveBeenCalled();
    });

    it('should call next() if no active terms exist', async () => {
      mockPrisma.termsOfService.findFirst.mockResolvedValue(null);
      const middleware = requireTermsAcceptance();
      
      await middleware(req, res, next);
      
      expect(mockPrisma.termsOfService.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { version: 'desc' }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should call next() if user has accepted the latest terms', async () => {
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue({
        userId: 'user123',
        termsOfServiceId: 'terms123',
        acceptedAt: recentDate
      });
      
      const middleware = requireTermsAcceptance();
      
      await middleware(req, res, next);
      
      expect(mockPrisma.termsOfService.findFirst).toHaveBeenCalled();
      expect(mockPrisma.userTermsAcceptance.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          termsOfServiceId: 'terms123'
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return API error if terms not accepted and apiResponse=true', async () => {
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      const middleware = requireTermsAcceptance({
        apiResponse: true,
        redirectOnFailure: false
      });
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Terms of service acceptance required',
        data: {
          termsRequired: true,
          termsVersion: '1.0',
          termsId: 'terms123'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect if terms not accepted and redirectOnFailure=true', async () => {
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      const middleware = requireTermsAcceptance({
        apiResponse: false,
        redirectOnFailure: true,
        redirectUrl: '/custom-terms'
      });
      
      await middleware(req, res, next);
      
      expect(res.redirect).toHaveBeenCalledWith('/custom-terms');
      expect(next).not.toHaveBeenCalled();
    });

    it('should send plain text response if terms not accepted and no specific options', async () => {
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      const middleware = requireTermsAcceptance({
        apiResponse: false,
        redirectOnFailure: false
      });
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('Terms of service acceptance required');
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.termsOfService.findFirst.mockRejectedValue(new Error('Database error'));
      const middleware = requireTermsAcceptance();
      
      await middleware(req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith('Error checking terms acceptance', { error: 'Database error' });
      expect(next).toHaveBeenCalled(); // Should allow access in case of error
    });
  });

  describe('requireTermsAcceptanceForApi', () => {
    it('should return a middleware function with API-specific options', () => {
      const middleware = requireTermsAcceptanceForApi();
      expect(typeof middleware).toBe('function');
      
      // Test that it's configured with the right options
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      return middleware(req, res, next).then(() => {
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireTermsAcceptanceForWeb', () => {
    it('should return a middleware function with web-specific options', () => {
      const middleware = requireTermsAcceptanceForWeb('/custom-path');
      expect(typeof middleware).toBe('function');
      
      // Test that it's configured with the right options
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      return middleware(req, res, next).then(() => {
        expect(res.redirect).toHaveBeenCalledWith('/custom-path');
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });
    });

    it('should use default redirect URL if not provided', () => {
      const middleware = requireTermsAcceptanceForWeb();
      expect(typeof middleware).toBe('function');
      
      // Test that it uses the default URL
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      return middleware(req, res, next).then(() => {
        expect(res.redirect).toHaveBeenCalledWith('/terms-acceptance');
      });
    });
  });

  describe('skipTermsAcceptanceForRoles', () => {
    it('should skip terms check for admin role', async () => {
      req.user.role = 'admin';
      const middleware = skipTermsAcceptanceForRoles();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(mockPrisma.termsOfService.findFirst).not.toHaveBeenCalled();
    });

    it('should skip terms check for system role', async () => {
      req.user.role = 'system';
      const middleware = skipTermsAcceptanceForRoles();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(mockPrisma.termsOfService.findFirst).not.toHaveBeenCalled();
    });

    it('should apply terms check for regular user role', async () => {
      req.user.role = 'user';
      mockPrisma.termsOfService.findFirst.mockResolvedValue({
        id: 'terms123',
        version: '1.0',
        isActive: true
      });
      
      mockPrisma.userTermsAcceptance.findFirst.mockResolvedValue(null);
      
      const middleware = skipTermsAcceptanceForRoles();
      
      await middleware(req, res, next);
      
      expect(mockPrisma.termsOfService.findFirst).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle case when no user is authenticated', async () => {
      req.user = null;
      const middleware = skipTermsAcceptanceForRoles();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(mockPrisma.termsOfService.findFirst).not.toHaveBeenCalled();
    });

    it('should allow custom roles to be specified', async () => {
      req.user.role = 'editor';
      const middleware = skipTermsAcceptanceForRoles(['editor', 'moderator']);
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(mockPrisma.termsOfService.findFirst).not.toHaveBeenCalled();
    });
  });
});
