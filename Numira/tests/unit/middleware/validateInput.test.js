/**
 * Unit Tests for Validate Input Middleware
 */

const validateInput = require('../../../middleware/validateInput');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('Validate Input Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      body: {},
      params: {},
      query: {}
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Mock next function
    next = jest.fn();
  });

  describe('validate', () => {
    it('should call next() when validation passes', () => {
      // Define a simple schema
      const schema = {
        body: {
          name: { type: 'string', required: true },
          age: { type: 'number', min: 18 }
        }
      };
      
      // Set valid request body
      req.body = {
        name: 'John Doe',
        age: 25
      };
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails', () => {
      // Define a simple schema
      const schema = {
        body: {
          name: { type: 'string', required: true },
          age: { type: 'number', min: 18 }
        }
      };
      
      // Set invalid request body (missing required field)
      req.body = {
        age: 25
      };
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
      expect(logger.warn).toHaveBeenCalledWith('Validation error', {
        errors: expect.any(Array),
        body: req.body
      });
    });

    it('should validate request params', () => {
      // Define a schema with params
      const schema = {
        params: {
          id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } // MongoDB ObjectId pattern
        }
      };
      
      // Set valid params
      req.params = {
        id: '507f1f77bcf86cd799439011'
      };
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should validate request query', () => {
      // Define a schema with query
      const schema = {
        query: {
          page: { type: 'number', min: 1 },
          limit: { type: 'number', min: 1, max: 100 }
        }
      };
      
      // Set valid query
      req.query = {
        page: '2',
        limit: '50'
      };
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should validate multiple request parts', () => {
      // Define a schema with body, params, and query
      const schema = {
        body: {
          name: { type: 'string', required: true }
        },
        params: {
          id: { type: 'string', required: true }
        },
        query: {
          filter: { type: 'string' }
        }
      };
      
      // Set valid request parts
      req.body = { name: 'John Doe' };
      req.params = { id: '123' };
      req.query = { filter: 'active' };
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return first validation error when multiple parts fail', () => {
      // Define a schema with body and params
      const schema = {
        body: {
          name: { type: 'string', required: true }
        },
        params: {
          id: { type: 'string', required: true }
        }
      };
      
      // Set invalid request parts
      req.body = {}; // Missing required name
      req.params = {}; // Missing required id
      
      const middleware = validateInput.validate(schema);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
      // Should have validation errors for both body and params
      expect(res.json.mock.calls[0][0].details.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateBody', () => {
    it('should call next() when body validation passes', () => {
      // Define a schema for the body
      const schema = {
        name: { type: 'string', required: true },
        email: { type: 'string', format: 'email' }
      };
      
      // Set valid request body
      req.body = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const middleware = validateInput.validateBody(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when body validation fails', () => {
      // Define a schema for the body
      const schema = {
        name: { type: 'string', required: true },
        email: { type: 'string', format: 'email' }
      };
      
      // Set invalid request body (invalid email)
      req.body = {
        name: 'John Doe',
        email: 'invalid-email'
      };
      
      const middleware = validateInput.validateBody(schema);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
      expect(logger.warn).toHaveBeenCalledWith('Validation error', {
        errors: expect.any(Array),
        body: req.body
      });
    });
  });

  describe('validateParams', () => {
    it('should call next() when params validation passes', () => {
      // Define a schema for the params
      const schema = {
        id: { type: 'string', required: true }
      };
      
      // Set valid request params
      req.params = {
        id: '123'
      };
      
      const middleware = validateInput.validateParams(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when params validation fails', () => {
      // Define a schema for the params
      const schema = {
        id: { type: 'number', required: true }
      };
      
      // Set invalid request params (string instead of number)
      req.params = {
        id: 'abc'
      };
      
      const middleware = validateInput.validateParams(schema);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
      expect(logger.warn).toHaveBeenCalledWith('Validation error', {
        errors: expect.any(Array),
        params: req.params
      });
    });
  });

  describe('validateQuery', () => {
    it('should call next() when query validation passes', () => {
      // Define a schema for the query
      const schema = {
        page: { type: 'number', min: 1 },
        limit: { type: 'number', min: 1, max: 100 }
      };
      
      // Set valid request query
      req.query = {
        page: '2',
        limit: '50'
      };
      
      const middleware = validateInput.validateQuery(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when query validation fails', () => {
      // Define a schema for the query
      const schema = {
        page: { type: 'number', min: 1 },
        limit: { type: 'number', min: 1, max: 100 }
      };
      
      // Set invalid request query (limit exceeds max)
      req.query = {
        page: '2',
        limit: '200'
      };
      
      const middleware = validateInput.validateQuery(schema);
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
      expect(logger.warn).toHaveBeenCalledWith('Validation error', {
        errors: expect.any(Array),
        query: req.query
      });
    });
  });

  describe('validateLogin', () => {
    it('should call next() when login validation passes', () => {
      // Set valid login request body
      req.body = {
        email: 'user@example.com',
        password: 'Password123!'
      };
      
      validateInput.validateLogin(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when login validation fails', () => {
      // Set invalid login request body (missing password)
      req.body = {
        email: 'user@example.com'
      };
      
      validateInput.validateLogin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
    });
  });

  describe('validateRegistration', () => {
    it('should call next() when registration validation passes', () => {
      // Set valid registration request body
      req.body = {
        name: 'John Doe',
        email: 'user@example.com',
        password: 'Password123!'
      };
      
      validateInput.validateRegistration(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when registration validation fails', () => {
      // Set invalid registration request body (weak password)
      req.body = {
        name: 'John Doe',
        email: 'user@example.com',
        password: '123'
      };
      
      validateInput.validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
    });
  });

  describe('validatePasswordReset', () => {
    it('should call next() when password reset validation passes', () => {
      // Set valid password reset request body
      req.body = {
        token: 'valid-token',
        password: 'NewPassword123!'
      };
      
      validateInput.validatePasswordReset(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when password reset validation fails', () => {
      // Set invalid password reset request body (missing token)
      req.body = {
        password: 'NewPassword123!'
      };
      
      validateInput.validatePasswordReset(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
    });
  });

  describe('validatePasswordChange', () => {
    it('should call next() when password change validation passes', () => {
      // Set valid password change request body
      req.body = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!'
      };
      
      validateInput.validatePasswordChange(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when password change validation fails', () => {
      // Set invalid password change request body (missing current password)
      req.body = {
        newPassword: 'NewPassword123!'
      };
      
      validateInput.validatePasswordChange(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation error',
        details: expect.any(Array)
      });
    });
  });

  describe('validateObjectId', () => {
    it('should call next() when ObjectId validation passes', () => {
      // Set valid MongoDB ObjectId
      req.params = {
        id: '507f1f77bcf86cd799439011'
      };
      
      const middleware = validateInput.validateObjectId('id');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when ObjectId validation fails', () => {
      // Set invalid MongoDB ObjectId
      req.params = {
        id: 'invalid-id'
      };
      
      const middleware = validateInput.validateObjectId('id');
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid ID format'
      });
    });

    it('should check ObjectId in request body if not in params', () => {
      // Set valid MongoDB ObjectId in body
      req.params = {};
      req.body = {
        userId: '507f1f77bcf86cd799439011'
      };
      
      const middleware = validateInput.validateObjectId('userId');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 when ObjectId is not found', () => {
      // No ID in params or body
      req.params = {};
      req.body = {};
      
      const middleware = validateInput.validateObjectId('id');
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ID parameter is required'
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input and call next()', () => {
      // Set request body with potentially harmful content
      req.body = {
        name: '<script>alert("XSS")</script>John Doe',
        description: 'Normal text with <b>some</b> HTML'
      };
      
      validateInput.sanitizeInput(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.body.name).not.toContain('<script>');
      expect(req.body.description).not.toContain('<b>');
    });

    it('should sanitize nested objects', () => {
      // Set request body with nested objects
      req.body = {
        user: {
          name: '<script>alert("XSS")</script>John Doe',
          profile: {
            bio: 'Bio with <img src="x" onerror="alert(1)">'
          }
        },
        comments: [
          { text: 'Comment with <script>bad()</script>' },
          { text: 'Normal comment' }
        ]
      };
      
      validateInput.sanitizeInput(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.body.user.name).not.toContain('<script>');
      expect(req.body.user.profile.bio).not.toContain('<img');
      expect(req.body.comments[0].text).not.toContain('<script>');
    });

    it('should handle non-object inputs', () => {
      // Set request body with primitive values
      req.body = 'String with <script>alert("XSS")</script>';
      
      validateInput.sanitizeInput(req, res, next);
      
      expect(next).toHaveBeenCalled();
      // String inputs should be left as is, not sanitized
      expect(req.body).toBe('String with <script>alert("XSS")</script>');
    });

    it('should sanitize query parameters', () => {
      // Set query params with potentially harmful content
      req.query = {
        search: '<script>alert("XSS")</script>keyword'
      };
      
      validateInput.sanitizeInput(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.query.search).not.toContain('<script>');
    });
  });
});
