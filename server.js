/**
 * Numira API Server
 * 
 * Main server entry point optimized for mobile app compatibility.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config/config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Initialize database connection
const db = require('./config/db');
db.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('DATABASE CONNECTION ERROR:', err);
  } else {
    logger.info('DATABASE CONNECTION SUCCESSFUL:', res.rows[0]);
  }
});

// Initialize Express app
const app = express();

// Security, optimization, and ethical compliance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://api.openai.com']
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
})); // Enhanced security headers
app.use(compression()); // Compresses responses for faster mobile data transfer
app.use(require('./middleware/sanitize')); // Data sanitization to prevent XSS and injection attacks
app.use(require('./middleware/contentModeration')); // Ethical content moderation

// Request parsing middleware with security limits
app.use(express.json({ 
  limit: '10mb', 
  verify: (req, res, buf) => { req.rawBody = buf.toString(); } // Store raw body for webhook verification
})); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration optimized for mobile with enhanced security
app.use(cors({
  origin: config.CORS_ORIGIN || '*', // Allow specified origins or all in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  credentials: true,
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 204 // Some legacy browsers choke on 204
}));

// Security audit logging for sensitive operations
app.use((req, res, next) => {
  // Log sensitive operations for security auditing
  const sensitiveRoutes = [
    '/api/auth',
    '/api/users',
    '/api/admin',
    '/api/account',
    '/api/payments'
  ];
  
  if (sensitiveRoutes.some(route => req.path.includes(route))) {
    logger.info('Security audit', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user ? req.user.id : 'unauthenticated'
    });
  }
  
  next();
});

// Logging middleware
app.use(morgan('combined', { stream: logger.stream }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime;
    logger.request(req, res, responseTime);
  });
  next();
});

// API Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/conversations', require('./routes/api/conversations'));
app.use('/api/insights', require('./routes/api/insights'));
app.use('/api/personas', require('./routes/api/personas'));
app.use('/api/ai', require('./routes/api/ai'));
app.use('/api/health', require('./routes/api/health'));
app.use('/api/analytics', require('./routes/api/analytics'));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  // Development route for root path
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'Welcome to Numira API',
      version: '1.0.0',
      documentation: '/api/docs'
    });
  });
}

// Global error handler with ethical considerations - must be after all routes
app.use(errorHandler);

// Add security headers to all responses
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});

// Start server
const PORT = config.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${config.NODE_ENV} mode`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

// Enhanced error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // In production, we might want to continue running despite errors
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Perform graceful shutdown to prevent data corruption
  logger.info('Graceful shutdown initiated due to uncaught exception');
  server.close(() => {
    logger.info('Server closed');
    // In production, we might want to restart the service
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown due to graceful shutdown timeout');
    process.exit(1);
  }, 30000);
});

module.exports = app; // Export for testing
