/**
 * Unit Tests for Role Check Middleware
 */

const roleCheckMiddleware = require('../../../middleware/roleCheck');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('Role Check Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      user: {
        id: 'user123',
        role: 'user'
      }
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      const requiredRole = 'user';
      const middleware = roleCheckMiddleware.requireRole(requiredRole);
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() when user has admin role', () => {
      const requiredRole = 'moderator';
      const middleware = roleCheckMiddleware.requireRole(requiredRole);
      
      req.user.role = 'admin';
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of the required roles', () => {
      const requiredRoles = ['admin', 'moderator', 'user'];
      const middleware = roleCheckMiddleware.requireRole(requiredRoles);
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      const requiredRole = 'admin';
      const middleware = roleCheckMiddleware.requireRole(requiredRole);
      
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
      const middleware = roleCheckMiddleware.requireRole(requiredRoles);
      
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

    it('should return 401 when user object is missing', () => {
      const requiredRole = 'admin';
      const middleware = roleCheckMiddleware.requireRole(requiredRole);
      
      // Remove user object
      delete req.user;
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication required' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Authentication required for role check');
    });
  });

  describe('requireAnyRole', () => {
    it('should call next() when user has one of the required roles', () => {
      const roles = ['admin', 'moderator', 'user'];
      const middleware = roleCheckMiddleware.requireAnyRole(roles);
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have any of the required roles', () => {
      const roles = ['admin', 'moderator'];
      const middleware = roleCheckMiddleware.requireAnyRole(roles);
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied: Insufficient permissions' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Access denied: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      });
    });

    it('should return 401 when user object is missing', () => {
      const roles = ['admin', 'moderator'];
      const middleware = roleCheckMiddleware.requireAnyRole(roles);
      
      // Remove user object
      delete req.user;
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication required' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Authentication required for role check');
    });
  });

  describe('requireAllRoles', () => {
    it('should call next() when user has all required roles', () => {
      const roles = ['user'];
      const middleware = roleCheckMiddleware.requireAllRoles(roles);
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next() when user has admin role', () => {
      const roles = ['user', 'moderator'];
      const middleware = roleCheckMiddleware.requireAllRoles(roles);
      
      req.user.role = 'admin';
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have all required roles', () => {
      const roles = ['user', 'moderator'];
      const middleware = roleCheckMiddleware.requireAllRoles(roles);
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied: Insufficient permissions' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Access denied: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      });
    });

    it('should return 401 when user object is missing', () => {
      const roles = ['user', 'moderator'];
      const middleware = roleCheckMiddleware.requireAllRoles(roles);
      
      // Remove user object
      delete req.user;
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Authentication required' 
      });
      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Authentication required for role check');
    });
  });

  describe('isAdmin', () => {
    it('should return true when user has admin role', () => {
      req.user.role = 'admin';
      
      const result = roleCheckMiddleware.isAdmin(req);
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have admin role', () => {
      const result = roleCheckMiddleware.isAdmin(req);
      
      expect(result).toBe(false);
    });

    it('should return false when user object is missing', () => {
      // Remove user object
      delete req.user;
      
      const result = roleCheckMiddleware.isAdmin(req);
      
      expect(result).toBe(false);
    });
  });

  describe('isModerator', () => {
    it('should return true when user has moderator role', () => {
      req.user.role = 'moderator';
      
      const result = roleCheckMiddleware.isModerator(req);
      
      expect(result).toBe(true);
    });

    it('should return true when user has admin role', () => {
      req.user.role = 'admin';
      
      const result = roleCheckMiddleware.isModerator(req);
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have moderator or admin role', () => {
      const result = roleCheckMiddleware.isModerator(req);
      
      expect(result).toBe(false);
    });

    it('should return false when user object is missing', () => {
      // Remove user object
      delete req.user;
      
      const result = roleCheckMiddleware.isModerator(req);
      
      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has specified role', () => {
      const result = roleCheckMiddleware.hasRole(req, 'user');
      
      expect(result).toBe(true);
    });

    it('should return true when user has admin role', () => {
      req.user.role = 'admin';
      
      const result = roleCheckMiddleware.hasRole(req, 'user');
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have specified role', () => {
      const result = roleCheckMiddleware.hasRole(req, 'moderator');
      
      expect(result).toBe(false);
    });

    it('should return false when user object is missing', () => {
      // Remove user object
      delete req.user;
      
      const result = roleCheckMiddleware.hasRole(req, 'user');
      
      expect(result).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has one of the specified roles', () => {
      const result = roleCheckMiddleware.hasAnyRole(req, ['admin', 'moderator', 'user']);
      
      expect(result).toBe(true);
    });

    it('should return true when user has admin role', () => {
      req.user.role = 'admin';
      
      const result = roleCheckMiddleware.hasAnyRole(req, ['moderator', 'user']);
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have any of the specified roles', () => {
      const result = roleCheckMiddleware.hasAnyRole(req, ['admin', 'moderator']);
      
      expect(result).toBe(false);
    });

    it('should return false when user object is missing', () => {
      // Remove user object
      delete req.user;
      
      const result = roleCheckMiddleware.hasAnyRole(req, ['admin', 'moderator', 'user']);
      
      expect(result).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true when user has all specified roles', () => {
      const result = roleCheckMiddleware.hasAllRoles(req, ['user']);
      
      expect(result).toBe(true);
    });

    it('should return true when user has admin role', () => {
      req.user.role = 'admin';
      
      const result = roleCheckMiddleware.hasAllRoles(req, ['moderator', 'user']);
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have all specified roles', () => {
      const result = roleCheckMiddleware.hasAllRoles(req, ['admin', 'user']);
      
      expect(result).toBe(false);
    });

    it('should return false when user object is missing', () => {
      // Remove user object
      delete req.user;
      
      const result = roleCheckMiddleware.hasAllRoles(req, ['user']);
      
      expect(result).toBe(false);
    });
  });
});
