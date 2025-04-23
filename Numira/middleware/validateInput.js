/**
 * Input Validation Middleware
 * 
 * Uses Zod for schema validation of request bodies, params, and queries.
 * Provides consistent error handling and response format.
 */

const { z } = require('zod');
const logger = require('../utils/logger');

/**
 * Create a validation middleware using the provided schema
 * 
 * @param {Object} schema - Zod schema object with body, params, query keys
 * @returns {Function} Express middleware function
 */
function validateInput(schema) {
  return (req, res, next) => {
    try {
      // Validate request body if schema.body is provided
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      
      // Validate request params if schema.params is provided
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      
      // Validate request query if schema.query is provided
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Input validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
          ip: req.ip
        });
        
        // Format validation errors for response
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          data: {
            errors: formattedErrors
          }
        });
      }
      
      // Pass other errors to the error handler
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
const schemas = {
  // User schemas
  user: {
    create: {
      body: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().min(2, 'Name must be at least 2 characters').optional()
      })
    },
    login: {
      body: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(1, 'Password is required')
      })
    },
    update: {
      body: z.object({
        name: z.string().min(2, 'Name must be at least 2 characters').optional(),
        email: z.string().email('Invalid email format').optional(),
        currentPassword: z.string().min(1, 'Current password is required').optional(),
        newPassword: z.string().min(8, 'New password must be at least 8 characters').optional()
      })
    },
    resetPassword: {
      body: z.object({
        email: z.string().email('Invalid email format')
      })
    },
    confirmReset: {
      body: z.object({
        token: z.string().min(1, 'Token is required'),
        password: z.string().min(8, 'Password must be at least 8 characters')
      })
    }
  },
  
  // Conversation schemas
  conversation: {
    create: {
      body: z.object({
        personaId: z.string().min(1, 'Persona ID is required'),
        roomId: z.string().min(1, 'Room ID is required'),
        title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters')
      })
    },
    message: {
      body: z.object({
        content: z.string().min(1, 'Message content is required').max(4000, 'Message must be less than 4000 characters'),
        conversationId: z.string().min(1, 'Conversation ID is required')
      })
    },
    update: {
      params: z.object({
        id: z.string().min(1, 'Conversation ID is required')
      }),
      body: z.object({
        title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters').optional(),
        archived: z.boolean().optional()
      })
    }
  },
  
  // Insight schemas
  insight: {
    create: {
      body: z.object({
        conversationId: z.string().min(1, 'Conversation ID is required'),
        content: z.string().min(1, 'Insight content is required')
      })
    }
  },
  
  // Feedback schemas
  feedback: {
    create: {
      body: z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().max(1000, 'Comment must be less than 1000 characters').optional(),
        conversationId: z.string().min(1, 'Conversation ID is required').optional(),
        messageId: z.string().min(1, 'Message ID is required').optional(),
        category: z.enum(['general', 'persona', 'room', 'insight', 'technical']).optional()
      })
    }
  },
  
  // ID parameter schema (reusable)
  idParam: {
    params: z.object({
      id: z.string().min(1, 'ID is required')
    })
  },
  
  // Pagination query schema (reusable)
  pagination: {
    query: z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional()
    })
  }
};

module.exports = {
  validateInput,
  schemas
};
