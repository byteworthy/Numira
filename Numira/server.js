const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');
const logger = require('./utils/logger');
const queueService = require('./services/queueService');
const cacheService = require('./services/cacheService');
const rateLimiter = require('./middleware/advancedRateLimiter');
const { setupSwagger } = require('./config/swagger');
const markdownIt = require('markdown-it')();
const fs = require('fs');

// Initialize Express app
const app = express();

// Trust proxy if configured (for production behind reverse proxy)
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

// Apply security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: config.server.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));

// Parse JSON request body
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// Compress responses
app.use(compression());

// Initialize Redis-dependent services
const initializeRedisServices = async () => {
  try {
    // Initialize queue service
    await queueService.initializeQueues();
    
    // Initialize cache service
    await cacheService.initializeRedis();
    
    // Initialize rate limiter
    await rateLimiter.initializeRedis();
    
    // Log Redis availability status
    logger.info('Redis services initialization complete', {
      queuesAvailable: queueService.isRedisAvailable(),
      cacheAvailable: cacheService.isRedisAvailable(),
      rateLimiterAvailable: rateLimiter.isRedisAvailable()
    });
  } catch (error) {
    logger.error('Error initializing Redis services', { error: error.message });
  }
};

// Apply standard rate limiting to all routes
app.use(rateLimiter.standardLimiter);

// Apply abuse detection middleware
app.use(rateLimiter.abuseDetection());

// Apply disclaimer middleware to all API responses
const disclaimerMiddleware = require('./middleware/disclaimer');
app.use(disclaimerMiddleware.addDisclaimerHeader);
app.use(disclaimerMiddleware.standardizeResponse);
app.use(disclaimerMiddleware.addDisclaimerToResponse);

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// App Store/Play Store compliance routes
app.get('/privacy-policy', (req, res) => {
  try {
    const privacyPolicyPath = path.join(__dirname, 'docs', 'PRIVACY_POLICY.md');
    const privacyPolicy = fs.existsSync(privacyPolicyPath) 
      ? fs.readFileSync(privacyPolicyPath, 'utf8')
      : '# Privacy Policy\n\nOur privacy policy is being updated. Please check back later.';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Numira - Privacy Policy</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #2c3e50; }
          h2 { color: #3498db; margin-top: 30px; }
          a { color: #3498db; }
          hr { border: 0; height: 1px; background: #eee; margin: 30px 0; }
          .footer { margin-top: 50px; font-size: 0.9em; color: #7f8c8d; text-align: center; }
        </style>
      </head>
      <body>
        ${markdownIt.render(privacyPolicy)}
        <div class="footer">
          <p>© ${new Date().getFullYear()} Byteworthy. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving privacy policy', { error: error.message });
    res.status(500).send('Error loading privacy policy');
  }
});

app.get('/terms-of-use', (req, res) => {
  try {
    const termsPath = path.join(__dirname, 'TERMS_OF_SERVICE.md');
    const terms = fs.existsSync(termsPath) 
      ? fs.readFileSync(termsPath, 'utf8')
      : '# Terms of Service\n\nOur terms of service are being updated. Please check back later.';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Numira - Terms of Service</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #2c3e50; }
          h2 { color: #3498db; margin-top: 30px; }
          a { color: #3498db; }
          hr { border: 0; height: 1px; background: #eee; margin: 30px 0; }
          .footer { margin-top: 50px; font-size: 0.9em; color: #7f8c8d; text-align: center; }
        </style>
      </head>
      <body>
        ${markdownIt.render(terms)}
        <div class="footer">
          <p>© ${new Date().getFullYear()} Byteworthy. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving terms of service', { error: error.message });
    res.status(500).send('Error loading terms of service');
  }
});

// API routes
app.use(`${config.server.apiPrefix}/users`, require('./routes/api/users'));
app.use(`${config.server.apiPrefix}/auth`, require('./routes/api/auth'));
app.use(`${config.server.apiPrefix}/personas`, require('./routes/api/personas'));
app.use(`${config.server.apiPrefix}/conversations`, require('./routes/api/conversations'));
app.use(`${config.server.apiPrefix}/insights`, require('./routes/api/insights'));
app.use(`${config.server.apiPrefix}/terms`, require('./routes/api/terms'));
app.use(`${config.server.apiPrefix}/notifications`, require('./routes/api/notifications'));
app.use(`${config.server.apiPrefix}/payments`, require('./routes/api/payments'));
app.use(`${config.server.apiPrefix}/ai`, require('./routes/api/ai'));
app.use(`${config.server.apiPrefix}/status`, require('./routes/api/status'));
app.use(`${config.server.apiPrefix}/admin`, require('./routes/api/admin'));
app.use(`${config.server.apiPrefix}/webhooks`, require('./routes/api/webhooks'));
app.use(`${config.server.apiPrefix}/feedback`, require('./routes/api/feedback'));
app.use(`${config.server.apiPrefix}/usage`, require('./routes/api/usage'));
app.use(`${config.server.apiPrefix}/account`, require('./routes/api/account'));
// Family routes removed - refocusing on single-user architecture
app.use(`${config.server.apiPrefix}/compliance`, require('./routes/api/compliance'));
app.use(`${config.server.apiPrefix}/system`, require('./routes/api/system'));
app.use(`${config.server.apiPrefix}/health`, require('./routes/api/health'));
app.use(`${config.server.apiPrefix}/disclaimer`, require('./routes/api/disclaimer'));
app.use(`${config.server.apiPrefix}/features`, require('./routes/api/features'));
app.use(`${config.server.apiPrefix}/rooms`, require('./routes/api/rooms'));
app.use(`${config.server.apiPrefix}/journals`, require('./routes/api/journals'));
app.use(`${config.server.apiPrefix}/llm`, require('./routes/api/llm'));
app.use(`${config.server.apiPrefix}/analytics`, require('./routes/api/analytics'));

// Metrics endpoint (if enabled)
if (process.env.METRICS_ENDPOINT_ENABLED === 'true') {
  const metrics = require('./routes/api/metrics');
  app.use(`${config.server.apiPrefix}/metrics`, metrics.router);
  
  // Add middleware to record request durations
  app.use((req, res, next) => {
    const start = process.hrtime();
    
    // Record response time on finish
    res.on('finish', () => {
      const end = process.hrtime(start);
      const duration = (end[0] * 1e9 + end[1]) / 1e9; // Convert to seconds
      
      // Extract route pattern from route stack
      let route = req.originalUrl;
      if (req.route && req.baseUrl) {
        route = req.baseUrl + req.route.path;
      }
      
      // Record the request
      metrics.recordHttpRequest(req.method, route, res.statusCode, duration);
    });
    
    next();
  });
  
  logger.info('Metrics endpoint enabled at /api/metrics');
}

// Set up Bull Board UI for queue monitoring
queueService.setupBullBoard(app);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, 'client/build')));

  // Serve index.html for any request that doesn't match an API route
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  logger.error(`Error: ${message}`, { 
    error: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, async () => {
  logger.info(`Server running in ${config.server.env} mode on port ${PORT}`);
  
  // Initialize Redis-dependent services
  await initializeRedisServices();
  
  // Initialize job processors
  queueService.initProcessors();
  
  // Set up queue monitoring
  queueService.setupQueueMonitoring();
  
  // Schedule recurring jobs
  queueService.scheduleRecurringJobs();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't crash the server in production
  if (process.env.NODE_ENV !== 'production') {
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Don't crash the server in production
  if (process.env.NODE_ENV !== 'production') {
    server.close(() => process.exit(1));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = server;
