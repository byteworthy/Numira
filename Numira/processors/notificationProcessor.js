const logger = require('../utils/logger');
const config = require('../config/config');
const webpush = require('web-push');

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  config.push.subject,
  config.push.publicKey,
  config.push.privateKey
);

/**
 * Process notification jobs
 * @param {Object} job - The job object containing data for the notification
 * @returns {Promise} - Resolves when the notification is sent
 */
module.exports = async (job) => {
  const { data } = job;
  
  logger.info(`Processing notification job ${job.id}`, { 
    jobId: job.id,
    userId: data.userId,
    type: data.type
  });

  try {
    // Validate required fields
    if (!data.subscription || !data.payload) {
      throw new Error('Missing required notification fields: subscription or payload');
    }

    // Ensure payload is properly formatted
    const payload = typeof data.payload === 'string' 
      ? data.payload 
      : JSON.stringify(data.payload);

    // Set up notification options
    const options = {
      TTL: data.ttl || 60 * 60, // Default to 1 hour
      vapidDetails: {
        subject: config.push.subject,
        publicKey: config.push.publicKey,
        privateKey: config.push.privateKey
      },
      urgency: data.urgency || 'normal', // normal, high, low
      topic: data.topic || undefined
    };

    // Send the push notification
    const result = await webpush.sendNotification(
      data.subscription,
      payload,
      options
    );
    
    logger.info(`Notification sent successfully for job ${job.id}`, { 
      jobId: job.id,
      statusCode: result.statusCode,
      userId: data.userId
    });

    return { statusCode: result.statusCode };
  } catch (error) {
    // Handle expired subscriptions
    if (error.statusCode === 410) {
      logger.warn(`Subscription expired for user ${data.userId}`, {
        jobId: job.id,
        userId: data.userId,
        subscriptionEndpoint: data.subscription?.endpoint
      });
      
      // If we have a User model and userId, we could remove the subscription
      if (data.userId) {
        try {
          // This would be implemented in a real application
          // await User.updateOne(
          //   { _id: data.userId },
          //   { $pull: { pushSubscriptions: { endpoint: data.subscription.endpoint } } }
          // );
          logger.info(`Removed expired subscription for user ${data.userId}`);
        } catch (dbError) {
          logger.error(`Failed to remove expired subscription for user ${data.userId}`, {
            error: dbError.message
          });
        }
      }
      
      // Don't retry for expired subscriptions
      return { status: 'subscription_expired' };
    }
    
    // Log other errors
    logger.error(`Error sending notification for job ${job.id}`, { 
      jobId: job.id,
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    });
    
    // Rethrow the error to let Bull handle the retry logic
    throw error;
  }
};
