/**
 * Disclaimer Service
 * 
 * Handles operations related to user disclaimer acknowledgments.
 * This service ensures users understand the non-clinical nature of the application.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check if a user has acknowledged the disclaimer
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - Object containing acceptance status and timestamp
 */
async function checkDisclaimerStatus(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        disclaimerAccepted: true,
        disclaimerAcceptedAt: true,
        disclaimerVersion: true
      }
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Check if disclaimer is expired (older than 90 days)
    let isExpired = false;
    if (user.disclaimerAcceptedAt) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      isExpired = user.disclaimerAcceptedAt < ninetyDaysAgo;
    }

    return {
      userId: user.id,
      accepted: user.disclaimerAccepted || false,
      acceptedAt: user.disclaimerAcceptedAt,
      version: user.disclaimerVersion || null,
      isExpired,
      isValid: user.disclaimerAccepted && !isExpired
    };
  } catch (error) {
    console.error('Error checking disclaimer status:', error);
    throw error;
  }
}

/**
 * Record a user's acknowledgment of the disclaimer
 * 
 * @param {string} userId - The user's ID
 * @param {string} version - The version of the disclaimer being acknowledged
 * @returns {Promise<Object>} - Updated user object
 */
async function acknowledgeDisclaimer(userId, version) {
  try {
    // Get current disclaimer version if not provided
    const disclaimerVersion = version || process.env.DISCLAIMER_VERSION || '1.0';
    
    // Update user record
    const updatedUser = await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        disclaimerAccepted: true,
        disclaimerAcceptedAt: new Date(),
        disclaimerVersion: disclaimerVersion
      },
      select: {
        id: true,
        disclaimerAccepted: true,
        disclaimerAcceptedAt: true,
        disclaimerVersion: true
      }
    });

    // Log the acknowledgment
    await prisma.userActivity.create({
      data: {
        userId: userId,
        activityType: 'DISCLAIMER_ACCEPTED',
        metadata: {
          version: disclaimerVersion,
          timestamp: new Date().toISOString()
        }
      }
    });

    return updatedUser;
  } catch (error) {
    console.error('Error acknowledging disclaimer:', error);
    throw error;
  }
}

/**
 * Get the current disclaimer text
 * 
 * @returns {Promise<Object>} - Disclaimer text and version
 */
async function getDisclaimerText() {
  try {
    // In a real implementation, this might come from a database
    // For now, we'll return a hardcoded disclaimer
    
    const disclaimerVersion = process.env.DISCLAIMER_VERSION || '1.0';
    
    return {
      version: disclaimerVersion,
      text: `
# IMPORTANT DISCLAIMER

## Non-Clinical Nature of Service

Numira is NOT a medical or mental health service. It is a self-reflection tool that uses AI to help you explore your thoughts and feelings.

## Not a Substitute for Professional Care

- Numira is NOT a substitute for professional medical advice, diagnosis, or treatment.
- Numira does NOT provide therapy, counseling, or any form of healthcare.
- The AI personas are NOT therapists, doctors, or healthcare professionals.

## Privacy and Data Use

- Do NOT share personally identifiable information (names, addresses, etc.).
- Do NOT share sensitive medical information.
- Your conversations are used to provide the service and may be reviewed to improve our systems.

## Emergency Situations

If you are experiencing a medical or mental health emergency, please:
- Call your local emergency number (e.g., 911 in the US)
- Contact a crisis helpline
- Seek immediate professional help

## Acknowledgment

By using Numira, you acknowledge that you understand these limitations and agree not to use the service for medical or mental health purposes.

Version ${disclaimerVersion}
Last Updated: ${new Date().toLocaleDateString()}
      `.trim()
    };
  } catch (error) {
    console.error('Error getting disclaimer text:', error);
    throw error;
  }
}

module.exports = {
  checkDisclaimerStatus,
  acknowledgeDisclaimer,
  getDisclaimerText
};
