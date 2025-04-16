const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'numira-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write moderation logs to moderation.log
    new winston.transports.File({
      filename: path.join(logsDir, 'moderation.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Add custom logging methods for specific contexts
logger.moderation = {
  flagged: (content, result) => {
    logger.warn({
      message: 'Content flagged by moderation',
      content: typeof content === 'string' ? content.substring(0, 100) + '...' : 'Non-string content',
      result,
      context: 'moderation'
    });
  },
  error: (message, error) => {
    logger.error({
      message,
      error,
      context: 'moderation'
    });
  }
};

// Add request logging
logger.request = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime.toFixed(2)}ms`,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    context: 'request'
  };

  // Add user ID if authenticated
  if (req.user) {
    logData.userId = req.user.id;
  }

  // Log based on status code
  if (res.statusCode >= 500) {
    logger.error(logData);
  } else if (res.statusCode >= 400) {
    logger.warn(logData);
  } else {
    logger.info(logData);
  }
};

// Add AI interaction logging
logger.ai = {
  request: (userId, persona, messageCount) => {
    logger.info({
      message: 'AI request',
      userId,
      persona,
      messageCount,
      context: 'ai'
    });
  },
  response: (userId, responseTime) => {
    logger.info({
      message: 'AI response',
      userId,
      responseTime: `${responseTime.toFixed(2)}ms`,
      context: 'ai'
    });
  },
  error: (userId, error) => {
    logger.error({
      message: 'AI error',
      userId,
      error,
      context: 'ai'
    });
  }
};

// Add security logging
logger.security = {
  authAttempt: (userId, success, ip) => {
    const level = success ? 'info' : 'warn';
    logger[level]({
      message: `Authentication ${success ? 'success' : 'failure'}`,
      userId,
      ip,
      context: 'security'
    });
  },
  accessDenied: (userId, resource, ip) => {
    logger.warn({
      message: 'Access denied',
      userId,
      resource,
      ip,
      context: 'security'
    });
  }
};

module.exports = logger;
