/**
 * Auth API Integration Tests
 * 
 * Tests the authentication API endpoints including:
 * - User registration
 * - User login
 * - Password reset
 * - Token verification
 */

const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../server');
const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('../../test-helpers');

describe('Auth API', () => {
  // Track test entities for cleanup
  const testEntities = {
    userIds: []
  };
  
  // Clean up test data after all tests
  afterAll(async () => {
    await cleanupTestData({
      userIds: testEntities.userIds
    });
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Setup
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      // Assert
      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data.user).to.have.property('id');
      expect(response.body.data.user).to.have.property('email', userData.email);
      expect(response.body.data.user).to.have.property('name', userData.name);
      expect(response.body.data.user).to.have.property('role', 'user');
      expect(response.body.data.user).not.to.have.property('password');
      
      // Store user ID for cleanup
      testEntities.userIds.push(response.body.data.user.id);
    });
    
    it('should return 400 if email is already in use', async () => {
      // Setup - Create a test user
      const existingUser = await createTestUser();
      testEntities.userIds.push(existingUser.id);
      
      // Setup - Attempt to register with the same email
      const userData = {
        email: existingUser.email,
        password: 'TestPassword123!',
        name: 'Duplicate Email User'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Email already in use');
    });
    
    it('should return 400 if password is too weak', async () => {
      // Setup
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'weak',
        name: 'Weak Password User'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Password does not meet requirements');
    });
    
    it('should return 400 if required fields are missing', async () => {
      // Setup - Missing email
      const userData1 = {
        password: 'TestPassword123!',
        name: 'Missing Email User'
      };
      
      // Execute
      const response1 = await request(app)
        .post('/api/auth/register')
        .send(userData1);
      
      // Assert
      expect(response1.status).to.equal(400);
      expect(response1.body).to.have.property('success', false);
      expect(response1.body).to.have.property('error');
      expect(response1.body.error).to.include('email is required');
      
      // Setup - Missing password
      const userData2 = {
        email: `test-${Date.now()}@example.com`,
        name: 'Missing Password User'
      };
      
      // Execute
      const response2 = await request(app)
        .post('/api/auth/register')
        .send(userData2);
      
      // Assert
      expect(response2.status).to.equal(400);
      expect(response2.body).to.have.property('success', false);
      expect(response2.body).to.have.property('error');
      expect(response2.body.error).to.include('password is required');
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login a user successfully with correct credentials', async () => {
      // Setup - Create a test user
      const password = 'TestPassword123!';
      const user = await createTestUser({ password });
      testEntities.userIds.push(user.id);
      
      // Setup - Login credentials
      const credentials = {
        email: user.email,
        password
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);
      
      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data).to.have.property('token');
      expect(response.body.data.user).to.have.property('id', user.id);
      expect(response.body.data.user).to.have.property('email', user.email);
      expect(response.body.data.user).not.to.have.property('password');
    });
    
    it('should return 401 if email is incorrect', async () => {
      // Setup
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);
      
      // Assert
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Invalid email or password');
    });
    
    it('should return 401 if password is incorrect', async () => {
      // Setup - Create a test user
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Setup - Login with wrong password
      const credentials = {
        email: user.email,
        password: 'WrongPassword123!'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);
      
      // Assert
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Invalid email or password');
    });
    
    it('should return 401 if user account is inactive', async () => {
      // Setup - Create an inactive test user
      const password = 'TestPassword123!';
      const user = await createTestUser({ 
        password,
        status: 'inactive'
      });
      testEntities.userIds.push(user.id);
      
      // Setup - Login credentials
      const credentials = {
        email: user.email,
        password
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);
      
      // Assert
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Account is inactive');
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return user data for authenticated user', async () => {
      // Setup - Create a test user
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Setup - Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'TestPassword123!'
        });
      
      const token = loginResponse.body.data.token;
      
      // Execute
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('user');
      expect(response.body.data.user).to.have.property('id', user.id);
      expect(response.body.data.user).to.have.property('email', user.email);
      expect(response.body.data.user).not.to.have.property('password');
    });
    
    it('should return 401 if no token is provided', async () => {
      // Execute
      const response = await request(app)
        .get('/api/auth/me');
      
      // Assert
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('No token provided');
    });
    
    it('should return 401 if token is invalid', async () => {
      // Execute
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      // Assert
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Invalid token');
    });
  });
  
  describe('POST /api/auth/forgot-password', () => {
    it('should generate a reset token for a valid user', async () => {
      // Setup - Create a test user
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Execute
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email });
      
      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Password reset email sent');
      
      // Verify that the user has a reset token in the database
      const updatedUser = await global.prisma.user.findUnique({
        where: { id: user.id }
      });
      
      expect(updatedUser).to.have.property('resetToken');
      expect(updatedUser).to.have.property('resetTokenExpiry');
    });
    
    it('should return 200 even if email does not exist (for security)', async () => {
      // Execute
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });
      
      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Password reset email sent');
    });
    
    it('should return 400 if email is not provided', async () => {
      // Execute
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Email is required');
    });
  });
  
  describe('POST /api/auth/reset-password', () => {
    it('should reset password with a valid token', async () => {
      // Setup - Create a test user with a reset token
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Setup - Generate a reset token
      const resetToken = 'valid-reset-token';
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour in the future
      
      await global.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });
      
      // Setup - Reset password data
      const resetData = {
        token: resetToken,
        password: 'NewPassword123!'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);
      
      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Password reset successful');
      
      // Verify that the user's reset token has been cleared
      const updatedUser = await global.prisma.user.findUnique({
        where: { id: user.id }
      });
      
      expect(updatedUser.resetToken).to.be.null;
      expect(updatedUser.resetTokenExpiry).to.be.null;
      
      // Verify that the user can login with the new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: resetData.password
        });
      
      expect(loginResponse.status).to.equal(200);
      expect(loginResponse.body).to.have.property('success', true);
    });
    
    it('should return 400 if token is invalid', async () => {
      // Setup
      const resetData = {
        token: 'invalid-token',
        password: 'NewPassword123!'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Invalid or expired reset token');
    });
    
    it('should return 400 if token is expired', async () => {
      // Setup - Create a test user with an expired reset token
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Setup - Generate an expired reset token
      const resetToken = 'expired-token';
      const resetTokenExpiry = new Date(Date.now() - 3600000); // 1 hour in the past
      
      await global.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });
      
      // Setup - Reset password data
      const resetData = {
        token: resetToken,
        password: 'NewPassword123!'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Invalid or expired reset token');
    });
    
    it('should return 400 if password is too weak', async () => {
      // Setup - Create a test user with a reset token
      const user = await createTestUser();
      testEntities.userIds.push(user.id);
      
      // Setup - Generate a reset token
      const resetToken = 'valid-reset-token';
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour in the future
      
      await global.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });
      
      // Setup - Reset password data with weak password
      const resetData = {
        token: resetToken,
        password: 'weak'
      };
      
      // Execute
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);
      
      // Assert
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Password does not meet requirements');
    });
  });
});
