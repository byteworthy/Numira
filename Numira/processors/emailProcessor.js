/**
 * Email Processor
 * 
 * Processes email jobs from the queue.
 * Handles sending emails via Postmark API.
 */

const postmark = require('postmark');
const logger = require('../utils/logger');

// Create Postmark client
const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

/**
 * Process email jobs
 * 
 * @param {Object} job - Bull job object
 * @returns {Promise<void>}
 */
async function processEmailJob(job) {
  const { data, name } = job;
  
  logger.info('Processing email job', {
    jobId: job.id,
    jobName: name,
    to: data.to,
    subject: data.subject || 'N/A',
    templateId: data.templateId || 'N/A'
  });
  
  try {
    switch (name) {
      case 'send':
        await sendEmail(data);
        break;
      case 'sendTemplate':
        await sendTemplateEmail(data);
        break;
      default:
        throw new Error(`Unknown email job type: ${name}`);
    }
    
    logger.info('Email job processed successfully', {
      jobId: job.id,
      jobName: name
    });
  } catch (error) {
    logger.error('Error processing email job', {
      jobId: job.id,
      jobName: name,
      error: error.message,
      stack: error.stack
    });
    
    // Rethrow the error to let Bull handle retries
    throw error;
  }
}

/**
 * Send an email via Postmark
 * 
 * @param {Object} data - Email data
 * @returns {Promise<Object>} Postmark response
 */
async function sendEmail(data) {
  const { to, subject, textBody, htmlBody, from, tag, metadata } = data;
  
  // Validate required fields
  if (!to || !subject || (!textBody && !htmlBody)) {
    throw new Error('Missing required email fields');
  }
  
  // Create email data
  const emailData = {
    From: from || process.env.POSTMARK_FROM_EMAIL,
    To: to,
    Subject: subject,
    TextBody: textBody,
    HtmlBody: htmlBody,
    MessageStream: 'outbound'
  };
  
  // Add optional fields if provided
  if (tag) {
    emailData.Tag = tag;
  }
  
  if (metadata) {
    emailData.Metadata = metadata;
  }
  
  // Add disclaimer to email body if not already present
  if (textBody && !textBody.includes('Numira is not a medical application')) {
    emailData.TextBody = `${textBody}\n\n---\nNumira is not a medical application and does not provide therapy, diagnosis, or treatment. It is designed for personal reflection only.`;
  }
  
  if (htmlBody && !htmlBody.includes('Numira is not a medical application')) {
    emailData.HtmlBody = `${htmlBody}\n<hr>\n<p style="font-size: 0.8em; color: #666;">Numira is not a medical application and does not provide therapy, diagnosis, or treatment. It is designed for personal reflection only.</p>`;
  }
  
  // Send email
  const response = await client.sendEmail(emailData);
  
  logger.info('Email sent successfully', {
    to,
    subject,
    messageId: response.MessageID
  });
  
  return response;
}

/**
 * Send a template email via Postmark
 * 
 * @param {Object} data - Template email data
 * @returns {Promise<Object>} Postmark response
 */
async function sendTemplateEmail(data) {
  const { to, templateId, templateData, from, tag, metadata } = data;
  
  // Validate required fields
  if (!to || !templateId || !templateData) {
    throw new Error('Missing required template email fields');
  }
  
  // Create email data
  const emailData = {
    From: from || process.env.POSTMARK_FROM_EMAIL,
    To: to,
    TemplateId: templateId,
    TemplateModel: {
      ...templateData,
      // Add disclaimer to template data if not already present
      disclaimer: templateData.disclaimer || 'Numira is not a medical application and does not provide therapy, diagnosis, or treatment. It is designed for personal reflection only.'
    },
    MessageStream: 'outbound'
  };
  
  // Add optional fields if provided
  if (tag) {
    emailData.Tag = tag;
  }
  
  if (metadata) {
    emailData.Metadata = metadata;
  }
  
  // Send email
  const response = await client.sendEmailWithTemplate(emailData);
  
  logger.info('Template email sent successfully', {
    to,
    templateId,
    messageId: response.MessageID
  });
  
  return response;
}

/**
 * Handle failed email jobs
 * 
 * @param {Object} job - Bull job object
 * @param {Error} error - Error object
 */
function handleFailedEmailJob(job, error) {
  logger.error('Email job failed', {
    jobId: job.id,
    jobName: job.name,
    error: error.message,
    stack: error.stack,
    attempts: job.attemptsMade,
    data: job.data
  });
  
  // Additional error handling logic can be added here
  // For example, sending an alert to admins for critical emails
  if (job.attemptsMade >= job.opts.attempts) {
    logger.error('Email job failed permanently', {
      jobId: job.id,
      jobName: job.name,
      to: job.data.to,
      subject: job.data.subject || 'N/A',
      templateId: job.data.templateId || 'N/A'
    });
    
    // Could add logic to notify admins or log to a monitoring system
  }
}

/**
 * Handle completed email jobs
 * 
 * @param {Object} job - Bull job object
 * @param {Object} result - Job result
 */
function handleCompletedEmailJob(job, result) {
  logger.info('Email job completed', {
    jobId: job.id,
    jobName: job.name,
    messageId: result?.MessageID || 'N/A'
  });
  
  // Additional completion handling logic can be added here
}

module.exports = {
  processEmailJob,
  handleFailedEmailJob,
  handleCompletedEmailJob
};
