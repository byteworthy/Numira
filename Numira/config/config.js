/**
 * Application configuration
 * 
 * This file contains all configuration settings for the application.
 * Environment variables are loaded from .env file using dotenv.
 */

require('dotenv').config();

// Parse CORS origins from environment variable or use default
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'https://numira.app'];

// Default configuration values
const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: corsOrigins,
    apiPrefix: process.env.API_PREFIX || '/api',
    trustProxy: process.env.TRUST_PROXY === 'true',
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true'
  },
  
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
    halfOpenSuccessThreshold: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD || '2', 10)
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/numira',
    ssl: process.env.DATABASE_SSL === 'true',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10)
  },
  
  // Redis configuration (for Bull queues, caching, etc.)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    cacheDb: parseInt(process.env.REDIS_CACHE_DB || '1', 10),
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  },
  
  // Cache configuration
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // Default 1 hour
    aiResponseTtl: parseInt(process.env.CACHE_AI_RESPONSE_TTL || '86400', 10), // Default 24 hours
    personaTtl: parseInt(process.env.CACHE_PERSONA_TTL || '3600', 10),
    roomTtl: parseInt(process.env.CACHE_ROOM_TTL || '3600', 10)
  },
  
  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    saltRounds: parseInt(process.env.SALT_ROUNDS || '10', 10)
  },
  
  // Email configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || 'user@example.com',
    password: process.env.EMAIL_PASSWORD || 'password',
    defaultFrom: process.env.EMAIL_FROM || 'Numira <no-reply@numira.app>'
  },
  
  // Push notification configuration
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@numira.app'
  },
  
  // AI service configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10)
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-2',
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1000', 10),
      timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || '30000', 10)
    }
  },
  
  // Payment service configuration
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      priceId: process.env.STRIPE_PRICE_ID
    },
    revenueCat: {
      apiKey: process.env.REVENUECAT_API_KEY,
      proxyKey: process.env.REVENUECAT_PROXY_KEY,
      webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET
    }
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    directory: process.env.LOG_DIRECTORY || './logs',
    maxSize: parseInt(process.env.LOG_MAX_SIZE || '5242880', 10), // 5MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10)
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per minute
    standardHeaders: process.env.RATE_LIMIT_HEADERS !== 'false',
    legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS === 'true'
  },
  
  // Offline sync configuration
  offlineSync: {
    maxQueueSize: parseInt(process.env.OFFLINE_MAX_QUEUE_SIZE || '100', 10),
    syncInterval: parseInt(process.env.OFFLINE_SYNC_INTERVAL || '60000', 10), // 1 minute
    maxRetries: parseInt(process.env.OFFLINE_MAX_RETRIES || '5', 10)
  },
  
  // Family plan configuration
  family: {
    maxMembers: parseInt(process.env.FAMILY_MAX_MEMBERS || '5', 10),
    inviteExpiryHours: parseInt(process.env.FAMILY_INVITE_EXPIRY_HOURS || '48', 10)
  },
  
  // Feature flags
  features: {
    offlineMode: process.env.FEATURE_OFFLINE_MODE !== 'false',
    pushNotifications: process.env.FEATURE_PUSH_NOTIFICATIONS !== 'false',
    familyPlans: process.env.FEATURE_FAMILY_PLANS === 'true',
    multilingualSupport: process.env.FEATURE_MULTILINGUAL === 'true',
    aiFailover: process.env.FEATURE_AI_FAILOVER !== 'false'
  }
};

// Environment-specific overrides
if (config.server.env === 'test') {
  // Test environment overrides
  config.database.url = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/numira_test';
  config.redis.db = parseInt(process.env.TEST_REDIS_DB || '1', 10);
  config.logging.level = 'error';
}

// Validate critical configuration
function validateConfig() {
  const errors = [];
  
  // In production, ensure critical secrets are set
  if (config.server.env === 'production') {
    if (config.auth.jwtSecret === 'development-secret-key-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
    
    if (!config.ai.openai.apiKey && !config.ai.anthropic.apiKey) {
      errors.push('At least one AI provider API key must be set in production');
    }
    
    if (config.features.pushNotifications && (!config.push.publicKey || !config.push.privateKey)) {
      errors.push('VAPID keys must be set for push notifications in production');
    }
  }
  
  // Log errors if any
  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    
    // In production, exit the process
    if (config.server.env === 'production') {
      process.exit(1);
    }
  }
}

// Run validation
validateConfig();

module.exports = config;
