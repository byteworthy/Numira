const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const config = require('../config/config');
const { addEmailJob } = require('../services/queueService');

/**
 * Process report generation jobs
 * @param {Object} job - The job object containing data for the report
 * @returns {Promise} - Resolves when the report is generated
 */
module.exports = async (job) => {
  const { data } = job;
  
  logger.info(`Processing report job ${job.id}`, { 
    jobId: job.id,
    type: data.type,
    userId: data.userId
  });

  try {
    // Validate required fields
    if (!data.type) {
      throw new Error('Missing required report field: type');
    }

    let reportData;
    let reportFilename;
    let reportTitle;
    
    // Generate different types of reports
    switch (data.type) {
      case 'user-activity':
        reportData = await generateUserActivityReport(data.userId, data.startDate, data.endDate);
        reportTitle = 'User Activity Report';
        reportFilename = `user_activity_${data.userId}_${Date.now()}.pdf`;
        break;
        
      case 'weekly-report':
        reportData = await generateWeeklyReport(data.startDate, data.endDate);
        reportTitle = 'Weekly System Report';
        reportFilename = `weekly_report_${Date.now()}.pdf`;
        break;
        
      case 'conversation-insights':
        reportData = await generateConversationInsightsReport(data.conversationId);
        reportTitle = 'Conversation Insights Report';
        reportFilename = `conversation_insights_${data.conversationId}_${Date.now()}.pdf`;
        break;
        
      default:
        throw new Error(`Unknown report type: ${data.type}`);
    }
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Generate PDF report
    const reportPath = path.join(reportsDir, reportFilename);
    await generatePDF(reportPath, reportTitle, reportData);
    
    logger.info(`Report generated successfully for job ${job.id}`, { 
      jobId: job.id,
      reportPath,
      type: data.type
    });
    
    // Send email with report if requested
    if (data.email) {
      await sendReportEmail(data.email, reportTitle, reportPath, data);
    }

    return { 
      reportPath,
      filename: reportFilename
    };
  } catch (error) {
    logger.error(`Error generating report for job ${job.id}`, { 
      jobId: job.id,
      error: error.message,
      stack: error.stack
    });
    
    // Rethrow the error to let Bull handle the retry logic
    throw error;
  }
};

/**
 * Generate user activity report
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date for report
 * @param {Date} endDate - End date for report
 * @returns {Promise<Object>} - Report data
 */
async function generateUserActivityReport(userId, startDate, endDate) {
  // This would be implemented with actual database queries
  // For now, we'll return mock data
  return {
    userId,
    period: {
      start: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: endDate || new Date()
    },
    sections: [
      {
        title: 'Conversation Summary',
        data: [
          { label: 'Total Conversations', value: 12 },
          { label: 'Average Length', value: '15 minutes' },
          { label: 'Most Active Day', value: 'Wednesday' }
        ]
      },
      {
        title: 'Persona Usage',
        data: [
          { label: 'Ayla', value: '45%' },
          { label: 'Cam', value: '30%' },
          { label: 'Rumi', value: '25%' }
        ]
      },
      {
        title: 'Insights Generated',
        data: [
          { label: 'Total Insights', value: 28 },
          { label: 'Top Category', value: 'Self-awareness' }
        ]
      }
    ]
  };
}

/**
 * Generate weekly system report
 * @param {Date} startDate - Start date for report
 * @param {Date} endDate - End date for report
 * @returns {Promise<Object>} - Report data
 */
async function generateWeeklyReport(startDate, endDate) {
  // This would be implemented with actual database queries
  // For now, we'll return mock data
  return {
    period: {
      start: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: endDate || new Date()
    },
    sections: [
      {
        title: 'System Usage',
        data: [
          { label: 'Active Users', value: 1250 },
          { label: 'New Users', value: 78 },
          { label: 'Total Conversations', value: 3420 },
          { label: 'Average Session Duration', value: '18 minutes' }
        ]
      },
      {
        title: 'Performance Metrics',
        data: [
          { label: 'Average Response Time', value: '1.2 seconds' },
          { label: 'API Success Rate', value: '99.8%' },
          { label: 'Error Rate', value: '0.2%' }
        ]
      },
      {
        title: 'Top Personas',
        data: [
          { label: 'Ayla', value: '42%' },
          { label: 'Cam', value: '31%' },
          { label: 'Rumi', value: '27%' }
        ]
      }
    ]
  };
}

/**
 * Generate conversation insights report
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} - Report data
 */
async function generateConversationInsightsReport(conversationId) {
  // This would be implemented with actual database queries
  // For now, we'll return mock data
  return {
    conversationId,
    date: new Date(),
    sections: [
      {
        title: 'Conversation Overview',
        data: [
          { label: 'Duration', value: '32 minutes' },
          { label: 'Messages Exchanged', value: 24 },
          { label: 'Persona', value: 'Ayla' }
        ]
      },
      {
        title: 'Key Themes',
        data: [
          { label: 'Primary Theme', value: 'Work-life balance' },
          { label: 'Secondary Theme', value: 'Stress management' },
          { label: 'Tertiary Theme', value: 'Goal setting' }
        ]
      },
      {
        title: 'Sentiment Analysis',
        data: [
          { label: 'Starting Sentiment', value: 'Neutral (0.2)' },
          { label: 'Ending Sentiment', value: 'Positive (0.7)' },
          { label: 'Overall Trend', value: 'Improving' }
        ]
      }
    ]
  };
}

/**
 * Generate PDF report
 * @param {string} filePath - Path to save the PDF
 * @param {string} title - Report title
 * @param {Object} data - Report data
 * @returns {Promise} - Resolves when PDF is generated
 */
function generatePDF(filePath, title, data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      // Handle stream events
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
      
      // Pipe PDF to file
      doc.pipe(stream);
      
      // Add title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown(2);
      
      // Add date range if available
      if (data.period) {
        const startDate = new Date(data.period.start).toLocaleDateString();
        const endDate = new Date(data.period.end).toLocaleDateString();
        doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
        doc.moveDown(2);
      }
      
      // Add user ID if available
      if (data.userId) {
        doc.fontSize(12).text(`User ID: ${data.userId}`, { align: 'left' });
        doc.moveDown();
      }
      
      // Add conversation ID if available
      if (data.conversationId) {
        doc.fontSize(12).text(`Conversation ID: ${data.conversationId}`, { align: 'left' });
        doc.moveDown();
      }
      
      // Add sections
      if (data.sections) {
        data.sections.forEach(section => {
          // Section title
          doc.fontSize(16).text(section.title);
          doc.moveDown();
          
          // Section data
          section.data.forEach(item => {
            doc.fontSize(12).text(`${item.label}: ${item.value}`);
            doc.moveDown(0.5);
          });
          
          doc.moveDown();
        });
      }
      
      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send email with report attachment
 * @param {string} email - Recipient email
 * @param {string} reportTitle - Report title
 * @param {string} reportPath - Path to report file
 * @param {Object} data - Original job data
 * @returns {Promise} - Resolves when email is queued
 */
async function sendReportEmail(email, reportTitle, reportPath, data) {
  // Read the report file
  const reportBuffer = fs.readFileSync(reportPath);
  
  // Create email job
  const emailJob = {
    to: email,
    subject: `${reportTitle} - ${new Date().toLocaleDateString()}`,
    html: `
      <h1>${reportTitle}</h1>
      <p>Please find attached your requested report.</p>
      <p>This report was generated on ${new Date().toLocaleString()}.</p>
    `,
    attachments: [
      {
        filename: path.basename(reportPath),
        content: reportBuffer
      }
    ]
  };
  
  // Add to email queue
  await addEmailJob(emailJob);
  
  logger.info(`Report email queued for ${email}`, {
    reportTitle,
    reportPath
  });
}
