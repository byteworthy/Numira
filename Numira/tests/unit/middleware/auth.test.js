/**
 * Unit Tests for Auth Middleware
 */

const authMiddleware = require('../../../middleware/auth');
const authService = require('../../../services/authService');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../services/authService');
jest.mock('../../../utils/logger');

describe('Auth Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      header: jest.fn(),
      cookies: {}
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
  });

  describe('authenticate', () => {
    it('should set req.user and call next() when token is valid', async () => {
      // Mock valid token
      const token = 'valid-token';
      const user = { id: 'user123', role: 'user' };
      
      req.header.mockReturnValue(`Bearer ${token}`);
      authService.verifyToken.mockResolvedValue(user);
      
      await authMiddleware.authenticate(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).toHaveBeenCalledWith(token);
      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should use token from cookies if Authorization header is not present', async () => {
      // Mock valid token in cookies
      const token = 'valid-cookie-token';
      const user = { id: 'user123', role: 'user' };
      
      req.header.mockReturnValue(null);
      req.cookies.token = token;
      authService.verifyToken.mockResolvedValue(user);
      
      await authMiddleware.authenticate(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).toHaveBeenCalledWith(token);
      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if no token is provided', async () => {
      req.header.mockReturnValue(null);
      
      await authMiddleware.authenticate(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication required' 
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token format is invalid', async () => {
      req.header.mockReturnValue('InvalidTokenFormat');
      
      await authMiddleware.authenticate(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid token format, expected "Bearer <token>"' 
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid token');
      
      req.header.mockReturnValue(`Bearer ${token}`);
      authService.verifyToken.mockRejectedValue(error);
      
      await authMiddleware.authenticate(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).toHaveBeenCalledWith(token);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid token' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Authentication failed', {
        error: error.message
      });
    });
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      const requiredRole = 'admin';
      const middleware = authMiddleware.requireRole(requiredRole);
      
      req.user = { id: 'user123', role: 'admin' };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of the required roles', () => {
      const requiredRoles = ['admin', 'moderator'];
      const middleware = authMiddleware.requireRole(requiredRoles);
      
      req.user = { id: 'user123', role: 'moderator' };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      const requiredRole = 'admin';
      const middleware = authMiddleware.requireRole(requiredRole);
      
      req.user = { id: 'user123', role: 'user' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied: Insufficient permissions' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Access denied: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole
      });
    });

    it('should return 403 when user does not have any of the required roles', () => {
      const requiredRoles = ['admin', 'moderator'];
      const middleware = authMiddleware.requireRole(requiredRoles);
      
      req.user = { id: 'user123', role: 'user' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied: Insufficient permissions' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Access denied: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole: requiredRoles
      });
    });

    it('should return 500 when user object is missing', () => {
      const requiredRole = 'admin';
      const middleware = authMiddleware.requireRole(requiredRole);
      
      // No user object on request
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication middleware not applied' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Authentication middleware not applied before role check');
    });
  });

  describe('requireOwnership', () => {
    it('should call next() when user is owner', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      req.user = { id: 'user123', role: 'user' };
      req.params = { userId: 'user123' };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() when user is admin', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      req.user = { id: 'admin123', role: 'admin' };
      req.params = { userId: 'user123' }; // Different user
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not owner', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      req.user = { id: 'user123', role: 'user' };
      req.params = { userId: 'user456' }; // Different user
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied: Resource belongs to another user' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Access denied: Resource belongs to another user', {
        userId: req.user.id,
        resourceId: req.params.userId
      });
    });

    it('should check resource ID in request body if not in params', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      req.user = { id: 'user123', role: 'user' };
      req.params = {}; // No params
      req.body = { userId: 'user123' }; // ID in body
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when resource ID is not found', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      req.user = { id: 'user123', role: 'user' };
      req.params = {}; // No params
      req.body = {}; // No body
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: `Resource ID field '${resourceIdField}' not found in request` 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(`Resource ID field '${resourceIdField}' not found in request`, {
        userId: req.user.id
      });
    });

    it('should return 500 when user object is missing', () => {
      const resourceIdField = 'userId';
      const middleware = authMiddleware.requireOwnership(resourceIdField);
      
      // No user object on request
      req.params = { userId: 'user123' };
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication middleware not applied' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Authentication middleware not applied before ownership check');
    });
  });

  describe('optional', () => {
    it('should set req.user and call next() when token is valid', async () => {
      const token = 'valid-token';
      const user = { id: 'user123', role: 'user' };
      
      req.header.mockReturnValue(`Bearer ${token}`);
      authService.verifyToken.mockResolvedValue(user);
      
      await authMiddleware.optional(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).toHaveBeenCalledWith(token);
      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() without setting req.user when no token is provided', async () => {
      req.header.mockReturnValue(null);
      
      await authMiddleware.optional(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() without setting req.user when token verification fails', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid token');
      
      req.header.mockReturnValue(`Bearer ${token}`);
      authService.verifyToken.mockRejectedValue(error);
      
      await authMiddleware.optional(req, res, next);
      
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(authService.verifyToken).toHaveBeenCalledWith(token);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Optional authentication failed', {
        error: error.message
      });
    });
  });
});
