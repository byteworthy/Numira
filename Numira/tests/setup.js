/**
 * Jest Setup File
 * 
 * This file runs before each test file and sets up the test environment.
 * It includes mocking external dependencies and setting up the database.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Set test environment
process.env.NODE_ENV = 'test';

// Mock external services
jest.mock('../services/openaiService');
jest.mock('../services/stripeService');
jest.mock('../services/revenueCatService');
jest.mock('../services/postmarkService');

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockImplementation((password) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn().mockImplementation((password, hash) => {
    // If the hash starts with 'hashed_', compare with the original password
    if (hash && hash.startsWith('hashed_')) {
      return Promise.resolve(password === hash.substring(7));
    }
    return Promise.resolve(false);
  })
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload, secret, options) => {
    return `mocked_token_for_${payload.id}`;
  }),
  verify: jest.fn().mockImplementation((token, secret, callback) => {
    if (token.startsWith('mocked_token_for_')) {
      const id = token.substring(16);
      callback(null, { id });
    } else {
      callback(new Error('Invalid token'));
    }
  })
}));

// Mock Redis
jest.mock('redis', () => {
  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockImplementation((key) => Promise.resolve(null)),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK')
  };

  return {
    createClient: jest.fn().mockReturnValue(mockRedisClient)
  };
});

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    process: jest.fn(),
    on: jest.fn(),
    getJob: jest.fn().mockResolvedValue({
      id: 'mock-job-id',
      data: {},
      progress: jest.fn(),
      moveToCompleted: jest.fn(),
      moveToFailed: jest.fn()
    }),
    getJobs: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0
    }),
    close: jest.fn().mockResolvedValue(true)
  }));
});

// Mock web-push
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({})
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    persona: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    room: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    journal: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    insight: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    webhook: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    notification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    feedback: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    terms: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    userTerms: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn().mockImplementation((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaClient);
      }
      return Promise.all(callback);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn()
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient)
  };
});

// Set up global variables
global.prisma = new PrismaClient();

// Set up console mocks to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Restore console functions after tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Set up test environment for each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset Prisma mock implementations
  Object.values(global.prisma).forEach(model => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach(method => {
        if (typeof method === 'function' && method.mockReset) {
          method.mockReset();
        }
      });
    }
  });
  
  // Set up default mock implementations
  global.prisma.user.findUnique.mockResolvedValue(null);
  global.prisma.user.findMany.mockResolvedValue([]);
  global.prisma.persona.findMany.mockResolvedValue([]);
  global.prisma.room.findMany.mockResolvedValue([]);
  global.prisma.conversation.findMany.mockResolvedValue([]);
  global.prisma.message.findMany.mockResolvedValue([]);
  global.prisma.journal.findMany.mockResolvedValue([]);
  global.prisma.insight.findMany.mockResolvedValue([]);
});

// Clean up after each test
afterEach(async () => {
  // Additional cleanup if needed
});
