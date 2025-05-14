/**
 * User Flow Integration Test: Registration and Conversation
 * 
 * Tests the complete user journey from registration to having a conversation
 * with an AI persona in a specific room.
 */

const request = require('supertest');
const app = require('../../../server');
const { PrismaClient } = require('@prisma/client');
const { cleanupTestData } = require('../../test-helpers');

// Create a Prisma client for database operations
const prisma = new PrismaClient();

describe('User Registration and Conversation Flow', () => {
  // Store created test entities for cleanup
  const testEntities = {
    userIds: [],
    conversationIds: [],
    messageIds: []
  };
  
  // Clean up after all tests
  afterAll(async () => {
    await cleanupTestData({
      messageIds: testEntities.messageIds,
      conversationIds: testEntities.conversationIds,
      userIds: testEntities.userIds
    });
    await prisma.$disconnect();
  });
  
  it('should allow a user to register, login, and have a conversation', async () => {
    // Step 1: Register a new user
    const userData = {
      email: `test-flow-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test Flow User'
    };
    
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.status).toBe('success');
    expect(registerResponse.body.data).toHaveProperty('user');
    
    const userId = registerResponse.body.data.user.id;
    testEntities.userIds.push(userId);
    
    // Step 2: Login with the new user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.status).toBe('success');
    expect(loginResponse.body.data).toHaveProperty('token');
    
    const token = loginResponse.body.data.token;
    
    // Step 3: Get available personas
    const personasResponse = await request(app)
      .get('/api/personas')
      .set('Authorization', `Bearer ${token}`);
    
    expect(personasResponse.status).toBe(200);
    expect(personasResponse.body.status).toBe('success');
    expect(personasResponse.body.data).toHaveProperty('personas');
    expect(personasResponse.body.data.personas.length).toBeGreaterThan(0);
    
    const persona = personasResponse.body.data.personas[0];
    
    // Step 4: Get available rooms
    const roomsResponse = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    
    expect(roomsResponse.status).toBe(200);
    expect(roomsResponse.body.status).toBe('success');
    expect(roomsResponse.body.data).toHaveProperty('rooms');
    expect(roomsResponse.body.data.rooms.length).toBeGreaterThan(0);
    
    // Find a room that supports the selected persona
    const room = roomsResponse.body.data.rooms.find(r => 
      r.supportedPersonas.includes(persona.id)
    );
    
    expect(room).toBeDefined();
    
    // Step 5: Create a new conversation
    const conversationData = {
      personaId: persona.id,
      roomId: room.id,
      title: 'Test Conversation'
    };
    
    const createConversationResponse = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send(conversationData);
    
    expect(createConversationResponse.status).toBe(201);
    expect(createConversationResponse.body.status).toBe('success');
    expect(createConversationResponse.body.data).toHaveProperty('conversation');
    expect(createConversationResponse.body.data.conversation).toHaveProperty('id');
    
    const conversationId = createConversationResponse.body.data.conversation.id;
    testEntities.conversationIds.push(conversationId);
    
    // Step 6: Send a message to the AI
    const messageData = {
      content: 'Hello, I would like to talk about my day.'
    };
    
    const sendMessageResponse = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send(messageData);
    
    expect(sendMessageResponse.status).toBe(201);
    expect(sendMessageResponse.body.status).toBe('success');
    expect(sendMessageResponse.body.data).toHaveProperty('message');
    expect(sendMessageResponse.body.data.message).toHaveProperty('id');
    expect(sendMessageResponse.body.data.message).toHaveProperty('role', 'user');
    
    const userMessageId = sendMessageResponse.body.data.message.id;
    testEntities.messageIds.push(userMessageId);
    
    // Step 7: Get AI response
    const aiResponseResponse = await request(app)
      .post(`/api/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        userInput: messageData.content,
        personaId: persona.id,
        roomId: room.id
      });
    
    expect(aiResponseResponse.status).toBe(200);
    expect(aiResponseResponse.body.status).toBe('success');
    expect(aiResponseResponse.body.data).toHaveProperty('response');
    expect(aiResponseResponse.body.data).toHaveProperty('messageId');
    
    const aiMessageId = aiResponseResponse.body.data.messageId;
    testEntities.messageIds.push(aiMessageId);
    
    // Step 8: Get conversation messages
    const getMessagesResponse = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(getMessagesResponse.status).toBe(200);
    expect(getMessagesResponse.body.status).toBe('success');
    expect(getMessagesResponse.body.data).toHaveProperty('messages');
    expect(getMessagesResponse.body.data.messages.length).toBe(2);
    
    const messages = getMessagesResponse.body.data.messages;
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe(messageData.content);
    expect(messages[1].role).toBe('assistant');
    
    // Step 9: Create a journal entry based on the conversation
    const journalData = {
      title: 'Reflections from my conversation',
      content: 'I had a great conversation with the AI today. It helped me process my thoughts.',
      mood: 'positive',
      tags: ['reflection', 'conversation']
    };
    
    const createJournalResponse = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send(journalData);
    
    expect(createJournalResponse.status).toBe(201);
    expect(createJournalResponse.body.status).toBe('success');
    expect(createJournalResponse.body.data).toHaveProperty('journal');
    expect(createJournalResponse.body.data.journal).toHaveProperty('id');
    
    const journalId = createJournalResponse.body.data.journal.id;
    testEntities.journalIds = testEntities.journalIds || [];
    testEntities.journalIds.push(journalId);
    
    // Step 10: Get user insights
    const getInsightsResponse = await request(app)
      .get('/api/insights')
      .set('Authorization', `Bearer ${token}`);
    
    expect(getInsightsResponse.status).toBe(200);
    expect(getInsightsResponse.body.status).toBe('success');
    
    // Step 11: Logout
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.status).toBe('success');
    expect(logoutResponse.body.message).toContain('Logged out successfully');
  });
  
  it('should handle invalid registration data', async () => {
    // Test with invalid email
    const invalidEmailData = {
      email: 'not-an-email',
      password: 'TestPassword123!',
      name: 'Invalid Email User'
    };
    
    const invalidEmailResponse = await request(app)
      .post('/api/auth/register')
      .send(invalidEmailData);
    
    expect(invalidEmailResponse.status).toBe(400);
    expect(invalidEmailResponse.body.status).toBe('error');
    expect(invalidEmailResponse.body.message).toContain('valid email');
    
    // Test with weak password
    const weakPasswordData = {
      email: 'weak-password@example.com',
      password: 'weak',
      name: 'Weak Password User'
    };
    
    const weakPasswordResponse = await request(app)
      .post('/api/auth/register')
      .send(weakPasswordData);
    
    expect(weakPasswordResponse.status).toBe(400);
    expect(weakPasswordResponse.body.status).toBe('error');
    expect(weakPasswordResponse.body.message).toContain('Password');
    
    // Test with missing name
    const missingNameData = {
      email: 'missing-name@example.com',
      password: 'TestPassword123!'
    };
    
    const missingNameResponse = await request(app)
      .post('/api/auth/register')
      .send(missingNameData);
    
    expect(missingNameResponse.status).toBe(400);
    expect(missingNameResponse.body.status).toBe('error');
    expect(missingNameResponse.body.message).toContain('required');
  });
  
  it('should handle unauthorized access to protected routes', async () => {
    // Try to access conversations without authentication
    const conversationsResponse = await request(app)
      .get('/api/conversations');
    
    expect(conversationsResponse.status).toBe(401);
    expect(conversationsResponse.body.status).toBe('error');
    expect(conversationsResponse.body.message).toContain('auth token');
    
    // Try to access user profile without authentication
    const profileResponse = await request(app)
      .get('/api/auth/me');
    
    expect(profileResponse.status).toBe(401);
    expect(profileResponse.body.status).toBe('error');
    expect(profileResponse.body.message).toContain('auth token');
    
    // Try to access admin routes with a regular user token
    // First, create a regular user
    const userData = {
      email: `test-regular-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test Regular User'
    };
    
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    expect(registerResponse.status).toBe(201);
    const userId = registerResponse.body.data.user.id;
    testEntities.userIds.push(userId);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });
    
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.data.token;
    
    // Try to access admin analytics
    const adminResponse = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${token}`);
    
    expect(adminResponse.status).toBe(403);
    expect(adminResponse.body.status).toBe('error');
    expect(adminResponse.body.message).toContain('permissions');
  });
});
