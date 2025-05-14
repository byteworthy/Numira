/**
 * Unit Tests for Queue Service
 */

const queueService = require('../../../services/queueService');
const Bull = require('bull');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

// Mock dependencies
jest.mock('bull');
jest.mock('../../../utils/logger');
jest.mock('../../../config/config', () => ({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'test-password'
  },
  queue: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true
    }
  }
}));

describe('Queue Service', () => {
  let mockQueue;
  const queueName = 'test-queue';
  const jobData = { id: 'job123', type: 'email', data: { to: 'test@example.com' } };
  const jobOptions = { priority: 1, delay: 5000 };
  const jobId = 'job123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Bull queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: jobId, ...jobData }),
      process: jest.fn(),
      getJob: jest.fn().mockResolvedValue({ id: jobId, ...jobData }),
      getJobs: jest.fn().mockResolvedValue([{ id: jobId, ...jobData }]),
      getJobCounts: jest.fn().mockResolvedValue({
        active: 1,
        completed: 5,
        failed: 2,
        delayed: 3,
        waiting: 4
      }),
      removeJobs: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue(['job123']),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };
    
    // Mock Bull constructor
    Bull.mockImplementation(() => mockQueue);
  });

  describe('createQueue', () => {
    it('should create a new queue', () => {
      const result = queueService.createQueue(queueName);
      
      expect(result).toBe(mockQueue);
      expect(Bull).toHaveBeenCalledWith(queueName, {
        redis: config.redis,
        defaultJobOptions: config.queue.defaultJobOptions
      });
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should set up error handlers', () => {
      queueService.createQueue(queueName);
      
      // Get the error handler function
      const errorHandler = mockQueue.on.mock.calls.find(call => call[0] === 'error')[1];
      const failedHandler = mockQueue.on.mock.calls.find(call => call[0] === 'failed')[1];
      
      // Simulate an error
      const error = new Error('Queue error');
      errorHandler(error);
      
      expect(logger.error).toHaveBeenCalledWith('Queue error', {
        queueName,
        error
      });
      
      // Simulate a failed job
      const job = { id: jobId, data: jobData };
      const failedError = new Error('Job failed');
      failedHandler(job, failedError);
      
      expect(logger.error).toHaveBeenCalledWith('Job failed', {
        queueName,
        jobId: job.id,
        jobData: job.data,
        error: failedError
      });
    });

    it('should return existing queue if already created', () => {
      const queue1 = queueService.createQueue(queueName);
      const queue2 = queueService.createQueue(queueName);
      
      expect(queue1).toBe(queue2);
      expect(Bull).toHaveBeenCalledTimes(1);
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const result = await queueService.addJob(queueName, jobData, jobOptions);
      
      expect(result).toEqual({ id: jobId, ...jobData });
      expect(Bull).toHaveBeenCalledWith(queueName, {
        redis: config.redis,
        defaultJobOptions: config.queue.defaultJobOptions
      });
      expect(mockQueue.add).toHaveBeenCalledWith(jobData, jobOptions);
    });

    it('should use default options if not provided', async () => {
      await queueService.addJob(queueName, jobData);
      
      expect(mockQueue.add).toHaveBeenCalledWith(jobData, undefined);
    });

    it('should handle errors gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.addJob(queueName, jobData))
        .rejects.toThrow('Failed to add job to queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error adding job to queue', {
        error: expect.any(Error),
        queueName,
        jobData
      });
    });
  });

  describe('processQueue', () => {
    it('should set up a processor for the queue', () => {
      const processor = jest.fn();
      const concurrency = 3;
      
      queueService.processQueue(queueName, processor, concurrency);
      
      expect(Bull).toHaveBeenCalledWith(queueName, {
        redis: config.redis,
        defaultJobOptions: config.queue.defaultJobOptions
      });
      expect(mockQueue.process).toHaveBeenCalledWith(concurrency, processor);
    });

    it('should use default concurrency if not provided', () => {
      const processor = jest.fn();
      
      queueService.processQueue(queueName, processor);
      
      expect(mockQueue.process).toHaveBeenCalledWith(1, processor);
    });

    it('should handle errors gracefully', () => {
      mockQueue.process.mockImplementation(() => {
        throw new Error('Process error');
      });
      
      const processor = jest.fn();
      
      expect(() => queueService.processQueue(queueName, processor))
        .toThrow('Failed to set up queue processor');
      
      expect(logger.error).toHaveBeenCalledWith('Error setting up queue processor', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('getJob', () => {
    it('should get a job by id', async () => {
      const result = await queueService.getJob(queueName, jobId);
      
      expect(result).toEqual({ id: jobId, ...jobData });
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
    });

    it('should return null if job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      
      const result = await queueService.getJob(queueName, jobId);
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.getJob(queueName, jobId))
        .rejects.toThrow('Failed to get job from queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting job from queue', {
        error: expect.any(Error),
        queueName,
        jobId
      });
    });
  });

  describe('getJobs', () => {
    it('should get jobs by status', async () => {
      const status = 'active';
      
      const result = await queueService.getJobs(queueName, status);
      
      expect(result).toEqual([{ id: jobId, ...jobData }]);
      expect(mockQueue.getJobs).toHaveBeenCalledWith([status]);
    });

    it('should get jobs by multiple statuses', async () => {
      const statuses = ['active', 'waiting'];
      
      const result = await queueService.getJobs(queueName, statuses);
      
      expect(result).toEqual([{ id: jobId, ...jobData }]);
      expect(mockQueue.getJobs).toHaveBeenCalledWith(statuses);
    });

    it('should handle errors gracefully', async () => {
      mockQueue.getJobs.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.getJobs(queueName, 'active'))
        .rejects.toThrow('Failed to get jobs from queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting jobs from queue', {
        error: expect.any(Error),
        queueName,
        status: 'active'
      });
    });
  });

  describe('getJobCounts', () => {
    it('should get job counts', async () => {
      const result = await queueService.getJobCounts(queueName);
      
      expect(result).toEqual({
        active: 1,
        completed: 5,
        failed: 2,
        delayed: 3,
        waiting: 4
      });
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQueue.getJobCounts.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.getJobCounts(queueName))
        .rejects.toThrow('Failed to get job counts from queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting job counts from queue', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('removeJob', () => {
    it('should remove a job by id', async () => {
      await queueService.removeJob(queueName, jobId);
      
      expect(mockQueue.removeJobs).toHaveBeenCalledWith(jobId);
    });

    it('should handle errors gracefully', async () => {
      mockQueue.removeJobs.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.removeJob(queueName, jobId))
        .rejects.toThrow('Failed to remove job from queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error removing job from queue', {
        error: expect.any(Error),
        queueName,
        jobId
      });
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      await queueService.pauseQueue(queueName);
      
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQueue.pause.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.pauseQueue(queueName))
        .rejects.toThrow('Failed to pause queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error pausing queue', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      await queueService.resumeQueue(queueName);
      
      expect(mockQueue.resume).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQueue.resume.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.resumeQueue(queueName))
        .rejects.toThrow('Failed to resume queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error resuming queue', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('cleanQueue', () => {
    it('should clean the queue', async () => {
      const grace = 5000;
      const status = 'completed';
      const limit = 1000;
      
      const result = await queueService.cleanQueue(queueName, grace, status, limit);
      
      expect(result).toEqual(['job123']);
      expect(mockQueue.clean).toHaveBeenCalledWith(grace, status, limit);
    });

    it('should use default parameters if not provided', async () => {
      await queueService.cleanQueue(queueName);
      
      expect(mockQueue.clean).toHaveBeenCalledWith(undefined, undefined, undefined);
    });

    it('should handle errors gracefully', async () => {
      mockQueue.clean.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.cleanQueue(queueName))
        .rejects.toThrow('Failed to clean queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error cleaning queue', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('closeQueue', () => {
    it('should close the queue', async () => {
      await queueService.closeQueue(queueName);
      
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQueue.close.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.closeQueue(queueName))
        .rejects.toThrow('Failed to close queue');
      
      expect(logger.error).toHaveBeenCalledWith('Error closing queue', {
        error: expect.any(Error),
        queueName
      });
    });
  });

  describe('closeAllQueues', () => {
    it('should close all queues', async () => {
      // Create multiple queues
      queueService.createQueue('queue1');
      queueService.createQueue('queue2');
      
      await queueService.closeAllQueues();
      
      expect(mockQueue.close).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      // Create a queue
      queueService.createQueue('queue1');
      
      mockQueue.close.mockRejectedValue(new Error('Queue error'));
      
      await expect(queueService.closeAllQueues())
        .rejects.toThrow('Failed to close all queues');
      
      expect(logger.error).toHaveBeenCalledWith('Error closing all queues', {
        error: expect.any(Error)
      });
    });
  });
});
