/**
 * Test Helpers
 * 
 * This file contains utility functions for tests, including:
 * - Creating test data
 * - Cleaning up test data
 * - Generating test tokens
 * - Creating authenticated test clients
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const request = require('supertest');
const config = require('../config/config');

// Create a Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Generate a JWT token for testing
 * 
 * @param {Object} user - User object to generate token for
 * @returns {string} JWT token
 */
const generateTestToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
};

/**
 * Create a test user in the database
 * 
 * @param {Object} overrides - Override default user properties
 * @returns {Promise<Object>} Created user object
 */
const createTestUser = async (overrides = {}) => {
  const timestamp = Date.now();
  const defaultUser = {
    email: `test-user-${timestamp}@example.com`,
    password: await bcrypt.hash('TestPassword123!', 10),
    name: `Test User ${timestamp}`,
    role: 'user',
    status: 'active'
  };

  const userData = { ...defaultUser, ...overrides };

  return prisma.user.create({
    data: userData
  });
};

/**
 * Create a test admin user in the database
 * 
 * @param {Object} overrides - Override default admin properties
 * @returns {Promise<Object>} Created admin user object
 */
const createTestAdmin = async (overrides = {}) => {
  const timestamp = Date.now();
  const defaultAdmin = {
    email: `test-admin-${timestamp}@example.com`,
    password: await bcrypt.hash('AdminPassword123!', 10),
    name: `Test Admin ${timestamp}`,
    role: 'admin',
    status: 'active'
  };

  const adminData = { ...defaultAdmin, ...overrides };

  return prisma.user.create({
    data: adminData
  });
};

/**
 * Login a test user and get auth token
 * 
 * @param {Object} app - Express app
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} JWT token
 */
const loginTestUser = async (app, email, password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return response.body.data.token;
};

/**
 * Create a test persona in the database
 * 
 * @param {Object} overrides - Override default persona properties
 * @returns {Promise<Object>} Created persona object
 */
const createTestPersona = async (overrides = {}) => {
  const timestamp = Date.now();
  const defaultPersona = {
    name: `Test Persona ${timestamp}`,
    description: `Test persona description ${timestamp}`,
    imageUrl: `https://example.com/persona-${timestamp}.jpg`,
    traits: ['empathetic', 'analytical'],
    active: true
  };

  const personaData = { ...defaultPersona, ...overrides };

  return prisma.persona.create({
    data: personaData
  });
};

/**
 * Create a test room in the database
 * 
 * @param {Object} overrides - Override default room properties
 * @returns {Promise<Object>} Created room object
 */
const createTestRoom = async (overrides = {}) => {
  const timestamp = Date.now();
  const defaultRoom = {
    name: `Test Room ${timestamp}`,
    description: `Test room description ${timestamp}`,
    imageUrl: `https://example.com/room-${timestamp}.jpg`,
    supportedPersonas: [],
    active: true
  };

  const roomData = { ...defaultRoom, ...overrides };

  return prisma.room.create({
    data: roomData
  });
};

/**
 * Create a test conversation in the database
 * 
 * @param {Object} overrides - Override default conversation properties
 * @returns {Promise<Object>} Created conversation object
 */
const createTestConversation = async (overrides = {}) => {
  const timestamp = Date.now();
  
  // Create user, persona, and room if not provided
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser();
    userId = user.id;
  }
  
  let personaId = overrides.personaId;
  if (!personaId) {
    const persona = await createTestPersona();
    personaId = persona.id;
  }
  
  let roomId = overrides.roomId;
  if (!roomId) {
    const room = await createTestRoom();
    roomId = room.id;
  }
  
  const defaultConversation = {
    title: `Test Conversation ${timestamp}`,
    userId,
    personaId,
    roomId,
    status: 'active'
  };

  const conversationData = { ...defaultConversation, ...overrides };

  return prisma.conversation.create({
    data: conversationData
  });
};

/**
 * Create test messages for a conversation
 * 
 * @param {string} conversationId - Conversation ID
 * @param {number} count - Number of messages to create (default: 2)
 * @returns {Promise<Array<Object>>} Created message objects
 */
const createTestMessages = async (conversationId, count = 2) => {
  const messages = [];
  
  // Create user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      content: `Test user message ${Date.now()}`,
      role: 'user'
    }
  });
  messages.push(userMessage);
  
  // Create assistant message
  if (count >= 2) {
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        content: `Test assistant message ${Date.now()}`,
        role: 'assistant'
      }
    });
    messages.push(assistantMessage);
  }
  
  // Create additional messages if needed
  for (let i = 2; i < count; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    const message = await prisma.message.create({
      data: {
        conversationId,
        content: `Test ${role} message ${Date.now()} - ${i}`,
        role
      }
    });
    messages.push(message);
  }
  
  return messages;
};

/**
 * Create a test journal entry in the database
 * 
 * @param {Object} overrides - Override default journal properties
 * @returns {Promise<Object>} Created journal object
 */
const createTestJournal = async (overrides = {}) => {
  const timestamp = Date.now();
  
  // Create user if not provided
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser();
    userId = user.id;
  }
  
  const defaultJournal = {
    title: `Test Journal ${timestamp}`,
    content: `Test journal content ${timestamp}`,
    userId,
    mood: 'neutral',
    tags: ['test', 'journal']
  };

  const journalData = { ...defaultJournal, ...overrides };

  return prisma.journal.create({
    data: journalData
  });
};

/**
 * Create a test insight in the database
 * 
 * @param {Object} overrides - Override default insight properties
 * @returns {Promise<Object>} Created insight object
 */
const createTestInsight = async (overrides = {}) => {
  const timestamp = Date.now();
  
  // Create user if not provided
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser();
    userId = user.id;
  }
  
  const defaultInsight = {
    title: `Test Insight ${timestamp}`,
    content: `Test insight content ${timestamp}`,
    userId,
    type: 'pattern',
    source: 'conversation'
  };

  const insightData = { ...defaultInsight, ...overrides };

  return prisma.insight.create({
    data: insightData
  });
};

/**
 * Clean up test data after tests
 * 
 * @param {Object} entities - Object containing arrays of entity IDs to clean up
 * @returns {Promise<void>}
 */
const cleanupTestData = async (entities = {}) => {
  // Delete messages
  if (entities.messageIds && entities.messageIds.length > 0) {
    await prisma.message.deleteMany({
      where: {
        id: {
          in: entities.messageIds
        }
      }
    });
  }
  
  // Delete conversations
  if (entities.conversationIds && entities.conversationIds.length > 0) {
    await prisma.conversation.deleteMany({
      where: {
        id: {
          in: entities.conversationIds
        }
      }
    });
  }
  
  // Delete journals
  if (entities.journalIds && entities.journalIds.length > 0) {
    await prisma.journal.deleteMany({
      where: {
        id: {
          in: entities.journalIds
        }
      }
    });
  }
  
  // Delete insights
  if (entities.insightIds && entities.insightIds.length > 0) {
    await prisma.insight.deleteMany({
      where: {
        id: {
          in: entities.insightIds
        }
      }
    });
  }
  
  // Delete rooms
  if (entities.roomIds && entities.roomIds.length > 0) {
    await prisma.room.deleteMany({
      where: {
        id: {
          in: entities.roomIds
        }
      }
    });
  }
  
  // Delete personas
  if (entities.personaIds && entities.personaIds.length > 0) {
    await prisma.persona.deleteMany({
      where: {
        id: {
          in: entities.personaIds
        }
      }
    });
  }
  
  // Delete users
  if (entities.userIds && entities.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: entities.userIds
        }
      }
    });
  }
};

/**
 * Create a test API client with authentication
 * 
 * @param {Object} app - Express app
 * @param {string} token - JWT token
 * @returns {Object} Authenticated supertest client
 */
const createAuthenticatedClient = (app, token) => {
  const client = request(app);
  
  // Override methods to include authorization header
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  methods.forEach(method => {
    const originalMethod = client[method];
    client[method] = function(url) {
      return originalMethod.call(this, url)
        .set('Authorization', `Bearer ${token}`);
    };
  });
  
  return client;
};

/**
 * Wait for a specified amount of time
 * 
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateTestToken,
  createTestUser,
  createTestAdmin,
  loginTestUser,
  createTestPersona,
  createTestRoom,
  createTestConversation,
  createTestMessages,
  createTestJournal,
  createTestInsight,
  cleanupTestData,
  createAuthenticatedClient,
  wait
};
