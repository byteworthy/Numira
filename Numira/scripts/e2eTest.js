/**
 * End-to-End Test Script
 * 
 * This script tests the complete user flow from signup to account deletion.
 * It uses supertest to make API requests and Jest for assertions.
 * 
 * Run with: npm run e2e:test
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Import server without starting it
const app = require('../server');

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

// Global variables to store state between tests
let authToken;
let userId;
let conversationId;

/**
 * Main test function
 */
async function runE2ETest() {
  console.log('\n🚀 Starting E2E Test\n');
  console.log(`Using test email: ${TEST_EMAIL}`);
  
  try {
    // Step 1: Signup
    await testSignup();
    
    // Step 2: Login
    await testLogin();
    
    // Step 3: Get user profile
    await testGetProfile();
    
    // Step 4: Create a conversation
    await testCreateConversation();
    
    // Step 5: Send a message and get AI response
    await testSendMessage();
    
    // Step 6: Get conversation history
    await testGetConversation();
    
    // Step 7: Get insights
    await testGetInsights();
    
    // Step 8: Test feature flags
    await testFeatureFlags();
    
    // Step 9: Test sessions
    await testSessions();
    
    // Step 10: Logout
    await testLogout();
    
    // Step 11: Login again for deletion
    await testLogin();
    
    // Step 12: Delete account
    await testDeleteAccount();
    
    // All tests passed
    console.log('\n✅ All tests passed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.body);
    }
    process.exit(1);
  } finally {
    // Clean up any test data
    await cleanupTestData();
  }
}

/**
 * Test user signup
 */
async function testSignup() {
  console.log('\n📝 Testing user signup...');
  
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME
    });
  
  if (response.status !== 201) {
    throw new Error(`Signup failed with status ${response.status}`);
  }
  
  userId = response.body.user.id;
  console.log('✅ Signup successful');
}

/**
 * Test user login
 */
async function testLogin() {
  console.log('\n🔑 Testing user login...');
  
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
  
  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}`);
  }
  
  authToken = response.body.token;
  console.log('✅ Login successful');
}

/**
 * Test getting user profile
 */
async function testGetProfile() {
  console.log('\n👤 Testing get user profile...');
  
  const response = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Get profile failed with status ${response.status}`);
  }
  
  if (response.body.email !== TEST_EMAIL) {
    throw new Error(`Profile email mismatch: ${response.body.email} !== ${TEST_EMAIL}`);
  }
  
  console.log('✅ Get profile successful');
}

/**
 * Test creating a conversation
 */
async function testCreateConversation() {
  console.log('\n💬 Testing create conversation...');
  
  const response = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      personaId: 'rumi', // Assuming 'rumi' is a valid persona
      title: 'E2E Test Conversation'
    });
  
  if (response.status !== 201) {
    throw new Error(`Create conversation failed with status ${response.status}`);
  }
  
  conversationId = response.body.id;
  console.log('✅ Create conversation successful');
}

/**
 * Test sending a message and getting AI response
 */
async function testSendMessage() {
  console.log('\n📨 Testing send message...');
  
  const response = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      content: 'Hello, this is a test message from the E2E test script.'
    });
  
  if (response.status !== 201) {
    throw new Error(`Send message failed with status ${response.status}`);
  }
  
  // Wait for AI response (may take a moment)
  console.log('⏳ Waiting for AI response...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get the latest messages
  const messagesResponse = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${authToken}`);
  
  if (messagesResponse.status !== 200) {
    throw new Error(`Get messages failed with status ${messagesResponse.status}`);
  }
  
  if (messagesResponse.body.length < 2) {
    throw new Error('No AI response received');
  }
  
  console.log('✅ Send message and receive AI response successful');
}

/**
 * Test getting conversation history
 */
async function testGetConversation() {
  console.log('\n📜 Testing get conversation...');
  
  const response = await request(app)
    .get(`/api/conversations/${conversationId}`)
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Get conversation failed with status ${response.status}`);
  }
  
  console.log('✅ Get conversation successful');
}

/**
 * Test getting insights
 */
async function testGetInsights() {
  console.log('\n🧠 Testing get insights...');
  
  // Insights might not be generated immediately, so we'll just check the endpoint works
  const response = await request(app)
    .get('/api/insights')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Get insights failed with status ${response.status}`);
  }
  
  console.log('✅ Get insights successful');
}

/**
 * Test feature flags
 */
async function testFeatureFlags() {
  console.log('\n🚩 Testing feature flags...');
  
  const response = await request(app)
    .get('/api/features')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Get feature flags failed with status ${response.status}`);
  }
  
  // Check if core features are enabled
  if (!response.body['core.journaling']) {
    throw new Error('Core journaling feature is not enabled');
  }
  
  console.log('✅ Feature flags check successful');
}

/**
 * Test sessions
 */
async function testSessions() {
  console.log('\n🔐 Testing sessions...');
  
  const response = await request(app)
    .get('/api/sessions')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Get sessions failed with status ${response.status}`);
  }
  
  if (!Array.isArray(response.body) || response.body.length === 0) {
    throw new Error('No active sessions found');
  }
  
  console.log('✅ Sessions check successful');
}

/**
 * Test logout
 */
async function testLogout() {
  console.log('\n🚪 Testing logout...');
  
  const response = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Logout failed with status ${response.status}`);
  }
  
  console.log('✅ Logout successful');
}

/**
 * Test account deletion
 */
async function testDeleteAccount() {
  console.log('\n❌ Testing account deletion...');
  
  const response = await request(app)
    .delete('/api/account')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (response.status !== 200) {
    throw new Error(`Delete account failed with status ${response.status}`);
  }
  
  console.log('✅ Account deletion request successful');
  
  // Verify the account is scheduled for deletion
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accountDeletion: true
    }
  });
  
  if (!user.accountDeletion || user.accountDeletion.status !== 'SCHEDULED') {
    throw new Error('Account not scheduled for deletion');
  }
  
  console.log('✅ Account deletion verification successful');
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Force delete the test user and all related data
    if (userId) {
      await prisma.$transaction([
        prisma.message.deleteMany({
          where: {
            conversation: {
              userId
            }
          }
        }),
        prisma.conversation.deleteMany({
          where: { userId }
        }),
        prisma.insight.deleteMany({
          where: { userId }
        }),
        prisma.session.deleteMany({
          where: { userId }
        }),
        prisma.accountDeletion.deleteMany({
          where: { userId }
        }),
        prisma.user.deleteMany({
          where: { id: userId }
        })
      ]);
    }
    
    console.log('✅ Cleanup successful');
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

// Run the tests
runE2ETest();
