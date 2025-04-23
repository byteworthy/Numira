const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Default configuration values
const defaultConfig = {
  // Server configuration
  PORT: 5000,
  NODE_ENV: 'development',
  
  // MongoDB configuration
  MONGO_URI: 'mongodb://localhost:27017/numira',
  
  // JWT configuration
  JWT_SECRET: 'your_jwt_secret',
  JWT_EXPIRE: '24h',
  
  // AI provider configuration
  AI_PROVIDER: 'openai', // 'openai' or 'anthropic'
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  
  // Default AI model configuration
  DEFAULT_MODEL: 'gpt-4-turbo',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 1000,
  
  // Moderation configuration
  MODERATION_ENABLED: true,
  MODERATION_PROVIDER: 'openai', // 'openai', 'anthropic', or 'keyword'
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // 100 requests per window
  
  // Logging configuration
  LOG_LEVEL: 'info',
  
  // CORS configuration
  CORS_ORIGIN: '*',
  
  // Client URL for redirects
  CLIENT_URL: 'http://localhost:3000',
  
  // File upload configuration
  UPLOAD_DIR: path.join(__dirname, '../uploads'),
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Email configuration
  EMAIL_SERVICE: '',
  EMAIL_USER: '',
  EMAIL_PASSWORD: '',
  EMAIL_FROM: 'noreply@numira.com',
  
  // Analytics configuration
  ANALYTICS_ENABLED: false,
  ANALYTICS_PROVIDER: '', // 'google', 'mixpanel', etc.
  ANALYTICS_KEY: '',
  
  // Mobile app configuration
  MOBILE_APP_ID: 'com.numira.app',
  
  // Subscription configuration
  SUBSCRIPTION_ENABLED: false,
  SUBSCRIPTION_PROVIDER: '', // 'stripe', 'paddle', etc.
  SUBSCRIPTION_KEY: '',
  
  // Feature flags
  FEATURES: {
    INSIGHTS: true,
    MULTIPLE_PERSONAS: true,
    OFFLINE_MODE: true,
    EXPORT_CONVERSATIONS: true,
    VOICE_INPUT: false,
    NOTIFICATIONS: true
  }
};

// Create configuration object by merging default values with environment variables
const config = {
  ...defaultConfig,
  
  // Server configuration
  PORT: process.env.PORT || defaultConfig.PORT,
  NODE_ENV: process.env.NODE_ENV || defaultConfig.NODE_ENV,
  
  // MongoDB configuration
  MONGO_URI: process.env.MONGO_URI || defaultConfig.MONGO_URI,
  
  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || defaultConfig.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || defaultConfig.JWT_EXPIRE,
  
  // AI provider configuration
  AI_PROVIDER: process.env.AI_PROVIDER || defaultConfig.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || defaultConfig.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || defaultConfig.ANTHROPIC_API_KEY,
  
  // Default AI model configuration
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || defaultConfig.DEFAULT_MODEL,
  DEFAULT_TEMPERATURE: parseFloat(process.env.DEFAULT_TEMPERATURE) || defaultConfig.DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS: parseInt(process.env.DEFAULT_MAX_TOKENS) || defaultConfig.DEFAULT_MAX_TOKENS,
  
  // Moderation configuration
  MODERATION_ENABLED: process.env.MODERATION_ENABLED === 'false' ? false : defaultConfig.MODERATION_ENABLED,
  MODERATION_PROVIDER: process.env.MODERATION_PROVIDER || defaultConfig.MODERATION_PROVIDER,
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || defaultConfig.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || defaultConfig.RATE_LIMIT_MAX_REQUESTS,
  
  // Logging configuration
  LOG_LEVEL: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL,
  
  // CORS configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || defaultConfig.CORS_ORIGIN,
  
  // Client URL for redirects
  CLIENT_URL: process.env.CLIENT_URL || defaultConfig.CLIENT_URL,
  
  // File upload configuration
  UPLOAD_DIR: process.env.UPLOAD_DIR || defaultConfig.UPLOAD_DIR,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || defaultConfig.MAX_FILE_SIZE,
  
  // Email configuration
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || defaultConfig.EMAIL_SERVICE,
  EMAIL_USER: process.env.EMAIL_USER || defaultConfig.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || defaultConfig.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || defaultConfig.EMAIL_FROM,
  
  // Analytics configuration
  ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED === 'true' ? true : defaultConfig.ANALYTICS_ENABLED,
  ANALYTICS_PROVIDER: process.env.ANALYTICS_PROVIDER || defaultConfig.ANALYTICS_PROVIDER,
  ANALYTICS_KEY: process.env.ANALYTICS_KEY || defaultConfig.ANALYTICS_KEY,
  
  // Mobile app configuration
  MOBILE_APP_ID: process.env.MOBILE_APP_ID || defaultConfig.MOBILE_APP_ID,
  
  // Subscription configuration
  SUBSCRIPTION_ENABLED: process.env.SUBSCRIPTION_ENABLED === 'true' ? true : defaultConfig.SUBSCRIPTION_ENABLED,
  SUBSCRIPTION_PROVIDER: process.env.SUBSCRIPTION_PROVIDER || defaultConfig.SUBSCRIPTION_PROVIDER,
  SUBSCRIPTION_KEY: process.env.SUBSCRIPTION_KEY || defaultConfig.SUBSCRIPTION_KEY,
  
  // Feature flags
  FEATURES: {
    INSIGHTS: process.env.FEATURE_INSIGHTS === 'false' ? false : defaultConfig.FEATURES.INSIGHTS,
    MULTIPLE_PERSONAS: process.env.FEATURE_MULTIPLE_PERSONAS === 'false' ? false : defaultConfig.FEATURES.MULTIPLE_PERSONAS,
    OFFLINE_MODE: process.env.FEATURE_OFFLINE_MODE === 'false' ? false : defaultConfig.FEATURES.OFFLINE_MODE,
    EXPORT_CONVERSATIONS: process.env.FEATURE_EXPORT_CONVERSATIONS === 'false' ? false : defaultConfig.FEATURES.EXPORT_CONVERSATIONS,
    VOICE_INPUT: process.env.FEATURE_VOICE_INPUT === 'true' ? true : defaultConfig.FEATURES.VOICE_INPUT,
    NOTIFICATIONS: process.env.FEATURE_NOTIFICATIONS === 'false' ? false : defaultConfig.FEATURES.NOTIFICATIONS
  }
};

module.exports = config;
