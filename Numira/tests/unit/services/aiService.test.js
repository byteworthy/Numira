/**
 * AI Service Unit Tests
 * 
 * Tests the AI service functionality including:
 * - Input sanitization
 * - PHI detection
 * - Rate limiting
 * - System prompt building
 * - OpenAI API interaction
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { getAIResponse } = require('../../../services/aiService');

// Mock dependencies
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    userActivity: {
      create: jest.fn()
    }
  }))
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    stream: { write: jest.fn() }
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock config files
jest.mock('../../../config/personas', () => [
  {
    id: 'ayla',
    name: 'Ayla',
    tone: 'warm, nurturing, gentle',
    voice: 'soft-spoken, soothing, compassionate',
    description: 'Ayla is warm, nurturing, and deeply empathetic.',
    systemPrompt: 'You are Ayla, a gentle and empathetic guide.',
    defaultRooms: ['mirrorRoom', 'moodBooth', 'clarityBar'],
    tags: ['empathetic', 'nurturing', 'gentle', 'supportive', 'warm']
  },
  {
    id: 'jax',
    name: 'Jax',
    tone: 'direct, honest, humorous',
    voice: 'straightforward, candid, witty',
    description: 'Jax is direct, honest, and refreshingly straightforward.',
    systemPrompt: 'You are Jax, a direct and honest guide.',
    defaultRooms: ['reframeRoom', 'clarityBar', 'moodBooth'],
    tags: ['direct', 'honest', 'humorous', 'challenging', 'straightforward']
  }
]);

jest.mock('../../../config/rooms', () => [
  {
    id: 'mirrorRoom',
    name: 'Mirror Room',
    description: 'A space for self-reflection and emotional exploration.',
    purpose: 'To help users gain insight into their emotions and thought patterns.',
    supportedPersonas: ['ayla', 'cam', 'rumi'],
    samplePrompt: 'I have been feeling overwhelmed lately and I am not sure why.',
    tags: ['reflection', 'emotional-awareness', 'self-discovery', 'insight'],
    promptType: 'open',
    features: {
      emotionTracking: true,
      patternRecognition: true,
      reflectiveQuestions: true,
      insightGeneration: true
    }
  },
  {
    id: 'reframeRoom',
    name: 'Reframe Room',
    description: 'A space for shifting perspectives and challenging limiting beliefs.',
    purpose: 'To help users break free from limiting perspectives.',
    supportedPersonas: ['cam', 'jax', 'rumi'],
    samplePrompt: 'I keep thinking I am not good enough for this job.',
    tags: ['perspective-shift', 'cognitive-reframing', 'belief-work', 'transformation'],
    promptType: 'targeted',
    features: {
      beliefIdentification: true,
      perspectiveShifting: true,
      thoughtChallenging: true,
      alternativeViewpoints: true
    }
  }
]);

describe('AI Service', () => {
  let openaiStub;
  
  beforeEach(() => {
    // Reset stubs and mocks
    jest.clearAllMocks();
    openaiStub = sinon.stub(require('openai').OpenAI.prototype.chat.completions, 'create');
  });
  
  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });
  
  describe('getAIResponse', () => {
    it('should throw an error if required parameters are missing', async () => {
      try {
        await getAIResponse({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Missing required parameters');
      }
    });
    
    it('should throw an error if persona is not found', async () => {
      try {
        await getAIResponse({
          userInput: 'Hello',
          personaId: 'nonexistent',
          roomId: 'mirrorRoom'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Persona not found');
      }
    });
    
    it('should throw an error if room is not found', async () => {
      try {
        await getAIResponse({
          userInput: 'Hello',
          personaId: 'ayla',
          roomId: 'nonexistent'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Room not found');
      }
    });
    
    it('should throw an error if persona is not compatible with room', async () => {
      try {
        await getAIResponse({
          userInput: 'Hello',
          personaId: 'jax',
          roomId: 'mirrorRoom'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not compatible');
      }
    });
    
    it('should detect PHI in user input', async () => {
      // Mock the containsPHI function to return true
      const originalContainsPHI = require('../../../services/aiService').containsPHI;
      require('../../../services/aiService').containsPHI = jest.fn().mockReturnValue(true);
      
      const response = await getAIResponse({
        userInput: 'My name is John Smith and my SSN is 123-45-6789',
        personaId: 'ayla',
        roomId: 'mirrorRoom'
      });
      
      expect(response).to.include('For your privacy');
      
      // Restore the original function
      require('../../../services/aiService').containsPHI = originalContainsPHI;
    });
    
    it('should call OpenAI API with correct parameters', async () => {
      // Mock the OpenAI API response
      openaiStub.resolves({
        choices: [{ message: { content: 'AI response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
      
      await getAIResponse({
        userInput: 'Hello',
        personaId: 'ayla',
        roomId: 'mirrorRoom'
      });
      
      expect(openaiStub.calledOnce).to.be.true;
      const call = openaiStub.getCall(0);
      expect(call.args[0].messages[0].role).to.equal('system');
      expect(call.args[0].messages[0].content).to.include('You are Ayla');
      expect(call.args[0].messages[0].content).to.include('Mirror Room');
      expect(call.args[0].messages[1].role).to.equal('user');
      expect(call.args[0].messages[1].content).to.equal('Hello');
    });
    
    it('should fall back to GPT-3.5 if GPT-4 fails', async () => {
      // Make GPT-4 fail on first call, then succeed with GPT-3.5
      openaiStub.onFirstCall().rejects(new Error('GPT-4 error'));
      openaiStub.onSecondCall().resolves({
        choices: [{ message: { content: 'GPT-3.5 response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
      
      const response = await getAIResponse({
        userInput: 'Hello',
        personaId: 'ayla',
        roomId: 'mirrorRoom'
      });
      
      expect(openaiStub.calledTwice).to.be.true;
      expect(openaiStub.firstCall.args[0].model).to.equal('gpt-4');
      expect(openaiStub.secondCall.args[0].model).to.equal('gpt-3.5-turbo');
      expect(response).to.equal('GPT-3.5 response');
    });
  });
});
