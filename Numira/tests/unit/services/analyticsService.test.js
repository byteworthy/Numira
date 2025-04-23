/**
 * Unit tests for the Analytics Service
 */

const analyticsService = require('../../../services/analyticsService');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockGroupBy = jest.fn();
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockDeleteMany = jest.fn();
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      analytics: {
        create: mockCreate,
        groupBy: mockGroupBy,
        findMany: mockFindMany,
        deleteMany: mockDeleteMany
      },
      aIMetrics: {
        create: mockCreate,
        findMany: mockFindMany,
        deleteMany: mockDeleteMany
      },
      persona: {
        findMany: mockFindMany
      },
      room: {
        findMany: mockFindMany
      },
      user: {
        count: mockCount
      },
      $disconnect: jest.fn()
    }))
  };
});

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
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

describe('Analytics Service', () => {
  let prisma;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get prisma instance
    prisma = new PrismaClient();
  });
  
  describe('trackInteraction', () => {
    it('should track user interaction successfully', async () => {
      // Setup
      const interactionData = {
        userId: 'user123',
        personaId: 'ayla',
        roomId: 'mirrorRoom',
        interactionType: 'conversation',
        metadata: { key: 'value' }
      };
      
      const expectedResult = {
        id: 'analytics123',
        ...interactionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      prisma.analytics.create.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await analyticsService.trackInteraction(interactionData);
      
      // Assert
      expect(prisma.analytics.create).toHaveBeenCalledWith({
        data: interactionData
      });
      expect(result).toEqual(expectedResult);
    });
    
    it('should throw error when tracking interaction fails', async () => {
      // Setup
      const interactionData = {
        userId: 'user123',
        personaId: 'ayla',
        roomId: 'mirrorRoom',
        interactionType: 'conversation'
      };
      
      const error = new Error('Database error');
      prisma.analytics.create.mockRejectedValue(error);
      
      // Execute & Assert
      await expect(analyticsService.trackInteraction(interactionData))
        .rejects
        .toThrow('Failed to track interaction: Database error');
    });
  });
  
  describe('trackAIResponse', () => {
    it('should track AI response metrics successfully', async () => {
      // Setup
      const metricsData = {
        userId: 'user123',
        personaId: 'ayla',
        roomId: 'mirrorRoom',
        responseTime: 1500,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        model: 'gpt-4',
        cached: false
      };
      
      const expectedResult = {
        id: 'metrics123',
        ...metricsData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      prisma.aIMetrics.create.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await analyticsService.trackAIResponse(metricsData);
      
      // Assert
      expect(prisma.aIMetrics.create).toHaveBeenCalledWith({
        data: metricsData
      });
      expect(result).toEqual(expectedResult);
    });
    
    it('should throw error when tracking AI response metrics fails', async () => {
      // Setup
      const metricsData = {
        userId: 'user123',
        personaId: 'ayla',
        roomId: 'mirrorRoom',
        responseTime: 1500,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        model: 'gpt-4'
      };
      
      const error = new Error('Database error');
      prisma.aIMetrics.create.mockRejectedValue(error);
      
      // Execute & Assert
      await expect(analyticsService.trackAIResponse(metricsData))
        .rejects
        .toThrow('Failed to track AI response metrics: Database error');
    });
  });
  
  describe('getPersonaStats', () => {
    it('should get persona usage statistics successfully', async () => {
      // Setup
      const personaStats = [
        { personaId: 'ayla', _count: { personaId: 450 } },
        { personaId: 'cam', _count: { personaId: 320 } }
      ];
      
      const personas = [
        { id: 'ayla', name: 'Ayla' },
        { id: 'cam', name: 'Cam' }
      ];
      
      prisma.analytics.groupBy.mockResolvedValue(personaStats);
      prisma.persona.findMany.mockResolvedValue(personas);
      
      // Execute
      const result = await analyticsService.getPersonaStats();
      
      // Assert
      expect(prisma.analytics.groupBy).toHaveBeenCalled();
      expect(prisma.persona.findMany).toHaveBeenCalled();
      expect(result).toEqual([
        { personaId: 'ayla', name: 'Ayla', count: 450 },
        { personaId: 'cam', name: 'Cam', count: 320 }
      ]);
    });
    
    it('should handle persona not found in database', async () => {
      // Setup
      const personaStats = [
        { personaId: 'ayla', _count: { personaId: 450 } },
        { personaId: 'unknown', _count: { personaId: 10 } }
      ];
      
      const personas = [
        { id: 'ayla', name: 'Ayla' }
      ];
      
      prisma.analytics.groupBy.mockResolvedValue(personaStats);
      prisma.persona.findMany.mockResolvedValue(personas);
      
      // Execute
      const result = await analyticsService.getPersonaStats();
      
      // Assert
      expect(result).toEqual([
        { personaId: 'ayla', name: 'Ayla', count: 450 },
        { personaId: 'unknown', name: 'unknown', count: 10 }
      ]);
    });
    
    it('should apply date filters when provided', async () => {
      // Setup
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      
      prisma.analytics.groupBy.mockResolvedValue([]);
      prisma.persona.findMany.mockResolvedValue([]);
      
      // Execute
      await analyticsService.getPersonaStats({ startDate, endDate });
      
      // Assert
      expect(prisma.analytics.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        })
      );
    });
  });
  
  describe('getRoomStats', () => {
    it('should get room usage statistics successfully', async () => {
      // Setup
      const roomStats = [
        { roomId: 'mirrorRoom', _count: { roomId: 520 } },
        { roomId: 'clarityBar', _count: { roomId: 310 } }
      ];
      
      const rooms = [
        { id: 'mirrorRoom', name: 'Mirror Room' },
        { id: 'clarityBar', name: 'Clarity Bar' }
      ];
      
      prisma.analytics.groupBy.mockResolvedValue(roomStats);
      prisma.room.findMany.mockResolvedValue(rooms);
      
      // Execute
      const result = await analyticsService.getRoomStats();
      
      // Assert
      expect(prisma.analytics.groupBy).toHaveBeenCalled();
      expect(prisma.room.findMany).toHaveBeenCalled();
      expect(result).toEqual([
        { roomId: 'mirrorRoom', name: 'Mirror Room', count: 520 },
        { roomId: 'clarityBar', name: 'Clarity Bar', count: 310 }
      ]);
    });
  });
  
  describe('cleanupOldAnalyticsData', () => {
    it('should clean up old analytics data successfully', async () => {
      // Setup
      prisma.analytics.deleteMany.mockResolvedValue({ count: 1250 });
      prisma.aIMetrics.deleteMany.mockResolvedValue({ count: 980 });
      
      // Execute
      const result = await analyticsService.cleanupOldAnalyticsData(90);
      
      // Assert
      expect(prisma.analytics.deleteMany).toHaveBeenCalled();
      expect(prisma.aIMetrics.deleteMany).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        deletedAnalytics: 1250,
        deletedAIMetrics: 980
      });
    });
    
    it('should handle errors during cleanup', async () => {
      // Setup
      const error = new Error('Database error');
      prisma.analytics.deleteMany.mockRejectedValue(error);
      
      // Execute
      const result = await analyticsService.cleanupOldAnalyticsData(90);
      
      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });
  
  describe('getSummary', () => {
    it('should get analytics summary successfully', async () => {
      // Setup - Mock all the individual stat functions
      const mockPersonaStats = [{ personaId: 'ayla', name: 'Ayla', count: 450 }];
      const mockRoomStats = [{ roomId: 'mirrorRoom', name: 'Mirror Room', count: 520 }];
      const mockCombinationStats = [{
        personaId: 'ayla',
        personaName: 'Ayla',
        roomId: 'mirrorRoom',
        roomName: 'Mirror Room',
        count: 250
      }];
      const mockAIStats = {
        totalRequests: 1050,
        tokens: { prompt: 210000, completion: 42000, total: 252000 },
        averageResponseTime: 1800,
        cacheHitRate: '15.24%',
        cacheHits: 160,
        cacheMisses: 890,
        models: [],
        estimatedCost: '7.30'
      };
      const mockUserStats = {
        totalUsers: 500,
        activeUsers: 320,
        newUsers: 45,
        totalInteractions: 2800,
        avgInteractionsPerUser: '8.75',
        topUsers: [],
        interactionFrequency: {}
      };
      
      // Mock the service methods
      jest.spyOn(analyticsService, 'getPersonaStats').mockResolvedValue(mockPersonaStats);
      jest.spyOn(analyticsService, 'getRoomStats').mockResolvedValue(mockRoomStats);
      jest.spyOn(analyticsService, 'getCombinationStats').mockResolvedValue(mockCombinationStats);
      jest.spyOn(analyticsService, 'getAIStats').mockResolvedValue(mockAIStats);
      jest.spyOn(analyticsService, 'getUserStats').mockResolvedValue(mockUserStats);
      
      // Execute
      const result = await analyticsService.getSummary();
      
      // Assert
      expect(analyticsService.getPersonaStats).toHaveBeenCalled();
      expect(analyticsService.getRoomStats).toHaveBeenCalled();
      expect(analyticsService.getCombinationStats).toHaveBeenCalled();
      expect(analyticsService.getAIStats).toHaveBeenCalled();
      expect(analyticsService.getUserStats).toHaveBeenCalled();
      
      expect(result).toEqual({
        dateRange: {
          startDate: null,
          endDate: null
        },
        users: {
          total: 500,
          active: 320,
          new: 45,
          avgInteractionsPerUser: '8.75'
        },
        interactions: {
          total: 2800,
          topPersonas: mockPersonaStats,
          topRooms: mockRoomStats,
          topCombinations: mockCombinationStats
        },
        ai: {
          totalRequests: 1050,
          totalTokens: 252000,
          estimatedCost: '$7.30',
          cacheHitRate: '15.24%',
          avgResponseTime: '1.80s'
        }
      });
    });
  });
});
