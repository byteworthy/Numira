/**
 * Postmark Email Service
 * 
 * Handles sending emails via Postmark API.
 * Uses Bull queue for asynchronous processing.
 */

const postmark = require('postmark');
const config = require('../config/config');
const logger = require('../utils/logger');
const queueService = require('./queueService');

// Create Postmark client
const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

/**
 * Send an email via Postmark
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.textBody - Plain text email body
 * @param {string} options.htmlBody - HTML email body
 * @param {string} options.from - Sender email (optional, defaults to config)
 * @param {string} options.tag - Email tag for analytics (optional)
 * @param {Object} options.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Postmark response
 */
async function sendEmail(options) {
  try {
    const { to, subject, textBody, htmlBody, from, tag, metadata } = options;
    
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
    
    // Send email
    const response = await client.sendEmail(emailData);
    
    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: response.MessageID
    });
    
    return response;
  } catch (error) {
    logger.error('Error sending email', {
      error: error.message,
      to: options.to,
      subject: options.subject
    });
    
    throw error;
  }
}

/**
 * Queue an email to be sent asynchronously
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.textBody - Plain text email body
 * @param {string} options.htmlBody - HTML email body
 * @param {string} options.from - Sender email (optional, defaults to config)
 * @param {string} options.tag - Email tag for analytics (optional)
 * @param {Object} options.metadata - Additional metadata (optional)
 * @param {Object} options.jobOptions - Bull queue job options (optional)
 * @returns {Promise<Object>} Bull job object
 */
async function queueEmail(options) {
  try {
    const { jobOptions, ...emailOptions } = options;
    
    // Add to email queue
    const job = await queueService.addJob('email', 'send', emailOptions, jobOptions);
    
    logger.info('Email queued successfully', {
      to: options.to,
      subject: options.subject,
      jobId: job.id
    });
    
    return job;
  } catch (error) {
    logger.error('Error queueing email', {
      error: error.message,
      to: options.to,
      subject: options.subject
    });
    
    throw error;
  }
}

/**
 * Send a template email via Postmark
 * 
 * @param {Object} options - Template email options
 * @param {string} options.to - Recipient email
 * @param {string} options.templateId - Postmark template ID
 * @param {Object} options.templateData - Template data
 * @param {string} options.from - Sender email (optional, defaults to config)
 * @param {string} options.tag - Email tag for analytics (optional)
 * @param {Object} options.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Postmark response
 */
async function sendTemplateEmail(options) {
  try {
    const { to, templateId, templateData, from, tag, metadata } = options;
    
    // Validate required fields
    if (!to || !templateId || !templateData) {
      throw new Error('Missing required template email fields');
    }
    
    // Create email data
    const emailData = {
      From: from || process.env.POSTMARK_FROM_EMAIL,
      To: to,
      TemplateId: templateId,
      TemplateModel: templateData,
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
  } catch (error) {
    logger.error('Error sending template email', {
      error: error.message,
      to: options.to,
      templateId: options.templateId
    });
    
    throw error;
  }
}

/**
 * Queue a template email to be sent asynchronously
 * 
 * @param {Object} options - Template email options
 * @param {string} options.to - Recipient email
 * @param {string} options.templateId - Postmark template ID
 * @param {Object} options.templateData - Template data
 * @param {string} options.from - Sender email (optional, defaults to config)
 * @param {string} options.tag - Email tag for analytics (optional)
 * @param {Object} options.metadata - Additional metadata (optional)
 * @param {Object} options.jobOptions - Bull queue job options (optional)
 * @returns {Promise<Object>} Bull job object
 */
async function queueTemplateEmail(options) {
  try {
    const { jobOptions, ...emailOptions } = options;
    
    // Add to email queue
    const job = await queueService.addJob('email', 'sendTemplate', emailOptions, jobOptions);
    
    logger.info('Template email queued successfully', {
      to: options.to,
      templateId: options.templateId,
      jobId: job.id
    });
    
    return job;
  } catch (error) {
    logger.error('Error queueing template email', {
      error: error.message,
      to: options.to,
      templateId: options.templateId
    });
    
    throw error;
  }
}

/**
 * Send a welcome email to a new user
 * 
 * @param {Object} user - User object
 * @returns {Promise<Object>} Bull job object
 */
async function sendWelcomeEmail(user) {
  try {
    const templateData = {
      name: user.name || 'there',
      appName: 'Numira',
      loginUrl: `${config.server.clientUrl}/login`,
      supportEmail: 'support@numira.app'
    };
    
    return await queueTemplateEmail({
      to: user.email,
      templateId: process.env.POSTMARK_TEMPLATE_WELCOME,
      templateData,
      tag: 'welcome',
      metadata: {
        userId: user.id
      }
    });
  } catch (error) {
    logger.error('Error sending welcome email', {
      error: error.message,
      userId: user.id,
      email: user.email
    });
    
    throw error;
  }
}

/**
 * Send a password reset email
 * 
 * @param {Object} user - User object
 * @param {string} token - Reset token
 * @returns {Promise<Object>} Bull job object
 */
async function sendPasswordResetEmail(user, token) {
  try {
    const resetUrl = `${config.server.clientUrl}/reset-password?token=${token}`;
    
    const templateData = {
      name: user.name || 'there',
      resetUrl,
      expiryHours: 24, // Token expiry in hours
      supportEmail: 'support@numira.app'
    };
    
    return await queueTemplateEmail({
      to: user.email,
      templateId: process.env.POSTMARK_TEMPLATE_PASSWORD_RESET,
      templateData,
      tag: 'password-reset',
      metadata: {
        userId: user.id
      }
    });
  } catch (error) {
    logger.error('Error sending password reset email', {
      error: error.message,
      userId: user.id,
      email: user.email
    });
    
    throw error;
  }
}

/**
 * Send a weekly reflection summary email
 * 
 * @param {Object} user - User object
 * @param {Object} summaryData - Summary data
 * @returns {Promise<Object>} Bull job object
 */
async function sendWeeklySummaryEmail(user, summaryData) {
  try {
    const templateData = {
      name: user.name || 'there',
      weekStartDate: summaryData.weekStartDate,
      weekEndDate: summaryData.weekEndDate,
      conversationCount: summaryData.conversationCount,
      messageCount: summaryData.messageCount,
      topInsights: summaryData.topInsights || [],
      mostActiveDay: summaryData.mostActiveDay,
      summaryUrl: `${config.server.clientUrl}/insights/weekly/${summaryData.weekId}`,
      unsubscribeUrl: `${config.server.clientUrl}/settings/notifications`
    };
    
    return await queueTemplateEmail({
      to: user.email,
      templateId: process.env.POSTMARK_TEMPLATE_WEEKLY_SUMMARY,
      templateData,
      tag: 'weekly-summary',
      metadata: {
        userId: user.id,
        weekId: summaryData.weekId
      }
    });
  } catch (error) {
    logger.error('Error sending weekly summary email', {
      error: error.message,
      userId: user.id,
      email: user.email,
      weekId: summaryData.weekId
    });
    
    throw error;
  }
}

/**
 * Send a notification email
 * 
 * @param {Object} user - User object
 * @param {Object} notification - Notification object
 * @returns {Promise<Object>} Bull job object
 */
async function sendNotificationEmail(user, notification) {
  try {
    const templateData = {
      name: user.name || 'there',
      notificationType: notification.type,
      notificationTitle: notification.title,
      notificationBody: notification.body,
      actionUrl: notification.actionUrl || `${config.server.clientUrl}/notifications`,
      unsubscribeUrl: `${config.server.clientUrl}/settings/notifications`
    };
    
    return await queueTemplateEmail({
      to: user.email,
      templateId: process.env.POSTMARK_TEMPLATE_NOTIFICATION,
      templateData,
      tag: `notification-${notification.type}`,
      metadata: {
        userId: user.id,
        notificationId: notification.id
      }
    });
  } catch (error) {
    logger.error('Error sending notification email', {
      error: error.message,
      userId: user.id,
      email: user.email,
      notificationId: notification.id
    });
    
    throw error;
  }
}

/**
 * Send a system report email to admins
 * 
 * @param {string} subject - Email subject
 * @param {Object} reportData - Report data
 * @returns {Promise<Object>} Bull job object
 */
async function sendSystemReportEmail(subject, reportData) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@numira.app';
    
    // Create HTML report
    let htmlBody = `
      <h1>${subject}</h1>
      <p>Generated at: ${new Date().toISOString()}</p>
      <hr>
    `;
    
    // Add report sections
    Object.entries(reportData).forEach(([sectionName, sectionData]) => {
      htmlBody += `<h2>${formatSectionName(sectionName)}</h2>`;
      
      if (typeof sectionData === 'object') {
        htmlBody += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">';
        
        // Add table rows for each item in the section
        Object.entries(sectionData).forEach(([key, value]) => {
          htmlBody += `
            <tr>
              <td><strong>${formatKey(key)}</strong></td>
              <td>${formatValue(value)}</td>
            </tr>
          `;
        });
        
        htmlBody += '</table>';
      } else {
        htmlBody += `<p>${sectionData}</p>`;
      }
      
      htmlBody += '<hr>';
    });
    
    // Add footer
    htmlBody += `
      <p>
        <small>
          This is an automated system report from Numira. 
          Please do not reply to this email.
        </small>
      </p>
    `;
    
    // Create plain text version
    let textBody = `${subject}\n\nGenerated at: ${new Date().toISOString()}\n\n`;
    
    // Add report sections
    Object.entries(reportData).forEach(([sectionName, sectionData]) => {
      textBody += `\n${formatSectionName(sectionName)}\n${'='.repeat(formatSectionName(sectionName).length)}\n\n`;
      
      if (typeof sectionData === 'object') {
        // Add lines for each item in the section
        Object.entries(sectionData).forEach(([key, value]) => {
          textBody += `${formatKey(key)}: ${formatValue(value, true)}\n`;
        });
      } else {
        textBody += `${sectionData}\n`;
      }
      
      textBody += '\n';
    });
    
    // Add footer
    textBody += `\nThis is an automated system report from Numira. Please do not reply to this email.`;
    
    return await queueEmail({
      to: adminEmail,
      subject,
      htmlBody,
      textBody,
      tag: 'system-report',
      jobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute
        }
      }
    });
  } catch (error) {
    logger.error('Error sending system report email', {
      error: error.message,
      subject
    });
    
    throw error;
  }
}

/**
 * Format a section name for display
 * 
 * @param {string} name - Section name
 * @returns {string} Formatted section name
 */
function formatSectionName(name) {
  return name
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Format a key for display
 * 
 * @param {string} key - Key name
 * @returns {string} Formatted key
 */
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .replace(/_/g, ' ') // Replace underscores with spaces
    .trim();
}

/**
 * Format a value for display
 * 
 * @param {*} value - Value to format
 * @param {boolean} isText - Whether formatting for plain text
 * @returns {string} Formatted value
 */
function formatValue(value, isText = false) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'None';
      }
      
      if (isText) {
        return value.map(item => `\n  - ${item}`).join('');
      } else {
        return `<ul>${value.map(item => `<li>${item}</li>`).join('')}</ul>`;
      }
    }
    
    try {
      return JSON.stringify(value, null, isText ? 2 : 0);
    } catch (e) {
      return String(value);
    }
  }
  
  return String(value);
}

module.exports = {
  sendEmail,
  queueEmail,
  sendTemplateEmail,
  queueTemplateEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendWeeklySummaryEmail,
  sendNotificationEmail,
  sendSystemReportEmail
};
