/**
 * Job Processors Index
 * 
 * Exports all job processors for the queue system.
 */

const emailProcessor = require('./emailProcessor');
const reportProcessor = require('./reportProcessor');
const cleanupProcessor = require('./cleanupProcessor');
const notificationProcessor = require('./notificationProcessor');

module.exports = {
  email: {
    process: emailProcessor.processEmailJob,
    onFailed: emailProcessor.handleFailedEmailJob,
    onCompleted: emailProcessor.handleCompletedEmailJob
  },
  report: {
    process: reportProcessor.processReportJob,
    onFailed: reportProcessor.handleFailedReportJob,
    onCompleted: reportProcessor.handleCompletedReportJob
  },
  cleanup: {
    process: cleanupProcessor.processCleanupJob,
    onFailed: cleanupProcessor.handleFailedCleanupJob,
    onCompleted: cleanupProcessor.handleCompletedCleanupJob
  },
  notification: {
    process: notificationProcessor.processNotificationJob,
    onFailed: notificationProcessor.handleFailedNotificationJob,
    onCompleted: notificationProcessor.handleCompletedNotificationJob
  }
};
