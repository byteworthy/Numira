/**
 * Unit Tests for Auth Service
 */

const authService = require('../../../services/authService');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../utils/logger');
jest.mock('../../../config/config', () => ({
  jwt: {
    secret: 'test-secret',
    expiresIn: '1h',
    refreshExpiresIn: '7d'
  },
  auth: {
    saltRounds: 10,
    passwordMinLength: 8
  }
}));

describe('Auth Service', () => {
  let mockPrisma;
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'user',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const mockToken = 'mock-jwt-token';
  const mockRefreshToken = 'mock-refresh-token';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      user: {
        create: jest.fn().mockResolvedValue(mockUser),
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
        delete: jest.fn().mockResolvedValue(mockUser)
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ token: mockRefreshToken, userId: mockUser.id }),
        findUnique: jest.fn().mockResolvedValue({ token: mockRefreshToken, userId: mockUser.id }),
        delete: jest.fn().mockResolvedValue({ token: mockRefreshToken, userId: mockUser.id })
      }
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
    
    // Mock bcrypt
    bcrypt.hash.mockResolvedValue('hashedPassword');
    bcrypt.compare.mockResolvedValue(true);
    
    // Mock jwt
    jwt.sign.mockImplementation((payload, secret, options) => {
      if (options.expiresIn === config.jwt.expiresIn) {
        return mockToken;
      } else {
        return mockRefreshToken;
      }
    });
    jwt.verify.mockImplementation((token) => {
      if (token === mockToken) {
        return { id: mockUser.id, email: mockUser.email };
      } else if (token === mockRefreshToken) {
        return { id: mockUser.id };
      }
      throw new Error('Invalid token');
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };
      
      const result = await authService.register(userData);
      
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role
        },
        token: mockToken,
        refreshToken: mockRefreshToken
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, config.auth.saltRounds);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: 'hashedPassword',
          firstName: userData.firstName,
          lastName: userData.lastName
        }
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error when email already exists', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('Unique constraint failed on the fields: (`email`)'));
      
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };
      
      await expect(authService.register(userData))
        .rejects.toThrow('Email already in use');
      
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, config.auth.saltRounds);
    });

    it('should throw error when password is too short', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'short',
        firstName: 'Test',
        lastName: 'User'
      };
      
      await expect(authService.register(userData))
        .rejects.toThrow(`Password must be at least ${config.auth.passwordMinLength} characters long`);
      
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));
      
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };
      
      await expect(authService.register(userData))
        .rejects.toThrow('Failed to register user');
      
      expect(logger.error).toHaveBeenCalledWith('Error registering user', {
        error: expect.any(Error),
        email: userData.email
      });
    });
  });

  describe('login', () => {
    it('should login a user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const result = await authService.login(credentials);
      
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role
        },
        token: mockToken,
        refreshToken: mockRefreshToken
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, mockUser.password);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };
      
      await expect(authService.login(credentials))
        .rejects.toThrow('Invalid email or password');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email }
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error when password is incorrect', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };
      
      await expect(authService.login(credentials))
        .rejects.toThrow('Invalid email or password');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, mockUser.password);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      await expect(authService.login(credentials))
        .rejects.toThrow('Failed to login');
      
      expect(logger.error).toHaveBeenCalledWith('Error logging in', {
        error: expect.any(Error),
        email: credentials.email
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token with valid refresh token', async () => {
      const result = await authService.refreshToken(mockRefreshToken);
      
      expect(result).toEqual({
        token: mockToken,
        refreshToken: mockRefreshToken
      });
      expect(jwt.verify).toHaveBeenCalledWith(mockRefreshToken, config.jwt.secret);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: mockRefreshToken }
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error when refresh token is invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await expect(authService.refreshToken(mockRefreshToken))
        .rejects.toThrow('Invalid refresh token');
      
      expect(jwt.verify).toHaveBeenCalledWith(mockRefreshToken, config.jwt.secret);
      expect(mockPrisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('should throw error when refresh token is not found in database', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      
      await expect(authService.refreshToken(mockRefreshToken))
        .rejects.toThrow('Invalid refresh token');
      
      expect(jwt.verify).toHaveBeenCalledWith(mockRefreshToken, config.jwt.secret);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: mockRefreshToken }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.refreshToken.findUnique.mockRejectedValue(new Error('Database error'));
      
      await expect(authService.refreshToken(mockRefreshToken))
        .rejects.toThrow('Failed to refresh token');
      
      expect(logger.error).toHaveBeenCalledWith('Error refreshing token', {
        error: expect.any(Error)
      });
    });
  });

  describe('logout', () => {
    it('should logout a user', async () => {
      await authService.logout(mockRefreshToken);
      
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: mockRefreshToken }
      });
    });

    it('should handle non-existent refresh token gracefully', async () => {
      mockPrisma.refreshToken.delete.mockRejectedValue(new Error('Record not found'));
      
      await authService.logout(mockRefreshToken);
      
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: mockRefreshToken }
      });
      expect(logger.warn).toHaveBeenCalledWith('Attempted to delete non-existent refresh token', {
        token: mockRefreshToken
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.refreshToken.delete.mockRejectedValue(new Error('Database error'));
      
      await expect(authService.logout(mockRefreshToken))
        .rejects.toThrow('Failed to logout');
      
      expect(logger.error).toHaveBeenCalledWith('Error logging out', {
        error: expect.any(Error)
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const result = await authService.verifyToken(mockToken);
      
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email
      });
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, config.jwt.secret);
    });

    it('should throw error when token is invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await expect(authService.verifyToken(mockToken))
        .rejects.toThrow('Invalid token');
      
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, config.jwt.secret);
    });

    it('should throw error when token is expired', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      
      await expect(authService.verifyToken(mockToken))
        .rejects.toThrow('Token expired');
      
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, config.jwt.secret);
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const userId = mockUser.id;
      const oldPassword = 'oldPassword';
      const newPassword = 'newPassword123';
      
      const result = await authService.changePassword(userId, oldPassword, newPassword);
      
      expect(result).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(oldPassword, mockUser.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, config.auth.saltRounds);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'hashedPassword' }
      });
    });

    it('should throw error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const userId = 'nonexistent';
      const oldPassword = 'oldPassword';
      const newPassword = 'newPassword123';
      
      await expect(authService.changePassword(userId, oldPassword, newPassword))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error when old password is incorrect', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const userId = mockUser.id;
      const oldPassword = 'wrongPassword';
      const newPassword = 'newPassword123';
      
      await expect(authService.changePassword(userId, oldPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(oldPassword, mockUser.password);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should throw error when new password is too short', async () => {
      const userId = mockUser.id;
      const oldPassword = 'oldPassword';
      const newPassword = 'short';
      
      await expect(authService.changePassword(userId, oldPassword, newPassword))
        .rejects.toThrow(`Password must be at least ${config.auth.passwordMinLength} characters long`);
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(oldPassword, mockUser.password);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('Database error'));
      
      const userId = mockUser.id;
      const oldPassword = 'oldPassword';
      const newPassword = 'newPassword123';
      
      await expect(authService.changePassword(userId, oldPassword, newPassword))
        .rejects.toThrow('Failed to change password');
      
      expect(logger.error).toHaveBeenCalledWith('Error changing password', {
        error: expect.any(Error),
        userId
      });
    });
  });

  describe('getUserById', () => {
    it('should get user by id', async () => {
      const userId = mockUser.id;
      
      const result = await authService.getUserById(userId);
      
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
    });

    it('should throw error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const userId = 'nonexistent';
      
      await expect(authService.getUserById(userId))
        .rejects.toThrow('User not found');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      const userId = mockUser.id;
      
      await expect(authService.getUserById(userId))
        .rejects.toThrow('Failed to get user');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting user', {
        error: expect.any(Error),
        userId
      });
    });
  });
});
