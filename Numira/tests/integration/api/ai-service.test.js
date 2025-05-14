/**
 * Integration Tests for AI Service API
 */

const request = require('supertest');
const app = require('../../../server');
const aiService = require('../../../services/aiService');
const llmProviderService = require('../../../services/llmProviderService');
const phiDetector = require('../../../utils/phiDetector');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('../../../services/aiService');
jest.mock('../../../services/llmProviderService');
jest.mock('../../../utils/phiDetector');
jest.mock('@prisma/client');

describe('AI Service API Integration Tests', () => {
  let mockPrisma;
  let mockUser;
  let authToken;

  beforeAll(() => {
    // Create a valid JWT token for testing
    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      role: 'user',
      subscriptionTier: 'premium',
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date(),
      termsAccepted: true
    };
    
    authToken = jwt.sign(
      { id: mockUser.id, email: mockUser.email, role: mockUser.role },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser)
      },
      conversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv123' }),
        update: jest.fn().mockResolvedValue({ id: 'conv123' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'conv123',
          userId: 'user123',
          messages: []
        })
      },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'msg123' })
      }
    };
    
    // Set up the mock implementation of PrismaClient
    PrismaClient.mockImplementation(() => mockPrisma);
    
    // Mock aiService methods
    aiService.generateResponse.mockResolvedValue({
      text: 'AI response',
      usage: { total_tokens: 100 },
      provider: 'openai'
    });
    
    aiService.generateConversationResponse.mockResolvedValue({
      text: 'AI conversation response',
      usage: { total_tokens: 150 },
      provider: 'openai'
    });
    
    aiService.generatePersonaResponse.mockResolvedValue({
      text: 'AI persona response',
      usage: { total_tokens: 200 },
      provider: 'openai'
    });
    
    // Mock llmProviderService methods
    llmProviderService.getProvider.mockReturnValue('openai');
    llmProviderService.getAvailableProviders.mockReturnValue(['openai', 'anthropic', 'azure']);
    llmProviderService.setProvider.mockReturnValue(true);
    
    // Mock phiDetector methods
    phiDetector.containsPHI.mockReturnValue(false);
  });

  describe('POST /api/ai/generate', () => {
    it('should generate AI response', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt',
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          response: 'AI response',
          usage: { total_tokens: 100 },
          provider: 'openai'
        }
      });
      expect(aiService.generateResponse).toHaveBeenCalledWith('Test prompt', { temperature: 0.5 });
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });

    it('should return 401 for missing auth token', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .send({
          prompt: 'Test prompt'
        });
      
      expect(response.status).toBe(401);
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });

    it('should return 403 when PHI is detected', async () => {
      // Mock PHI detection
      phiDetector.containsPHI.mockReturnValue(true);
      phiDetector.getPHIDetectionMessage.mockReturnValue('PHI detected in input');
      
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt with PHI'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('PHI detected in input');
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      aiService.generateResponse.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/ai/conversation', () => {
    it('should generate conversation response', async () => {
      const conversation = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];
      
      const response = await request(app)
        .post('/api/ai/conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversation,
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          response: 'AI conversation response',
          usage: { total_tokens: 150 },
          provider: 'openai'
        }
      });
      expect(aiService.generateConversationResponse).toHaveBeenCalledWith(conversation, { temperature: 0.5 });
    });

    it('should return 400 for missing conversation', async () => {
      const response = await request(app)
        .post('/api/ai/conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(aiService.generateConversationResponse).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid conversation format', async () => {
      const response = await request(app)
        .post('/api/ai/conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversation: 'Not an array'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(aiService.generateConversationResponse).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/ai/persona', () => {
    it('should generate persona response', async () => {
      const persona = {
        name: 'Ayla',
        description: 'A helpful assistant',
        systemPrompt: 'You are Ayla, a helpful assistant.'
      };
      
      const response = await request(app)
        .post('/api/ai/persona')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt',
          persona,
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          response: 'AI persona response',
          usage: { total_tokens: 200 },
          provider: 'openai'
        }
      });
      expect(aiService.generatePersonaResponse).toHaveBeenCalledWith('Test prompt', persona, { temperature: 0.5 });
    });

    it('should return 400 for missing prompt', async () => {
      const persona = {
        name: 'Ayla',
        description: 'A helpful assistant',
        systemPrompt: 'You are Ayla, a helpful assistant.'
      };
      
      const response = await request(app)
        .post('/api/ai/persona')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          persona,
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(aiService.generatePersonaResponse).not.toHaveBeenCalled();
    });

    it('should return 400 for missing persona', async () => {
      const response = await request(app)
        .post('/api/ai/persona')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt',
          options: { temperature: 0.5 }
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(aiService.generatePersonaResponse).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/ai/provider', () => {
    it('should return current provider', async () => {
      const response = await request(app)
        .get('/api/ai/provider')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          provider: 'openai',
          availableProviders: ['openai', 'anthropic', 'azure']
        }
      });
      expect(llmProviderService.getProvider).toHaveBeenCalled();
      expect(llmProviderService.getAvailableProviders).toHaveBeenCalled();
    });

    it('should require admin role for non-GET methods', async () => {
      // Create a non-admin user token
      const userToken = jwt.sign(
        { id: 'user456', email: 'user@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .post('/api/ai/provider')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          provider: 'anthropic'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
      expect(llmProviderService.setProvider).not.toHaveBeenCalled();
    });

    it('should allow admin to change provider', async () => {
      // Create an admin user token
      const adminToken = jwt.sign(
        { id: 'admin123', email: 'admin@example.com', role: 'admin' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .post('/api/ai/provider')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'anthropic'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        data: {
          provider: 'anthropic'
        }
      });
      expect(llmProviderService.setProvider).toHaveBeenCalledWith('anthropic');
    });

    it('should return 400 for invalid provider', async () => {
      // Mock setProvider to return false for invalid provider
      llmProviderService.setProvider.mockReturnValue(false);
      
      // Create an admin user token
      const adminToken = jwt.sign(
        { id: 'admin123', email: 'admin@example.com', role: 'admin' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .post('/api/ai/provider')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'invalid-provider'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(llmProviderService.setProvider).toHaveBeenCalledWith('invalid-provider');
    });
  });
});
