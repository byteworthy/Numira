const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
require('winston-daily-rotate-file');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Determine log level based on environment
let logLevel = config.logging.level || 'info';
if (process.env.NODE_ENV === 'production') {
  logLevel = 'info';
} else if (process.env.NODE_ENV === 'development') {
  logLevel = 'debug';
} else if (process.env.NODE_ENV === 'test') {
  logLevel = 'error'; // Minimal logging in test environment
}

// Create rotating file transports
const errorRotateFile = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: jsonFormat
});

const combinedRotateFile = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: jsonFormat
});

const moderationRotateFile = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'moderation-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'warn',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: jsonFormat
});

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'numira-api' },
  transports: [
    errorRotateFile,
    combinedRotateFile,
    moderationRotateFile
  ],
  // Don't exit on error
  exitOnError: false
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// In test environment, we might want to silence logs completely
if (process.env.NODE_ENV === 'test' && process.env.LOG_SILENT === 'true') {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
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

// Add queue logging
logger.queue = {
  jobAdded: (queueName, jobId, data) => {
    logger.debug({
      message: 'Job added to queue',
      queueName,
      jobId,
      data: JSON.stringify(data).substring(0, 200) + '...',
      context: 'queue'
    });
  },
  jobCompleted: (queueName, jobId, result) => {
    logger.debug({
      message: 'Job completed',
      queueName,
      jobId,
      result: result ? JSON.stringify(result).substring(0, 200) + '...' : null,
      context: 'queue'
    });
  },
  jobFailed: (queueName, jobId, error) => {
    logger.error({
      message: 'Job failed',
      queueName,
      jobId,
      error,
      context: 'queue'
    });
  }
};

module.exports = logger;
