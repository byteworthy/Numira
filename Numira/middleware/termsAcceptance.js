/**
 * Terms Acceptance Middleware
 * 
 * Ensures users have accepted the terms of service before using the application.
 */

const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check if user has accepted the latest terms of service
 * 
 * @param {Object} options - Options
 * @param {boolean} options.redirectOnFailure - Whether to redirect on failure
 * @param {string} options.redirectUrl - URL to redirect to if terms not accepted
 * @param {boolean} options.apiResponse - Whether to return API response on failure
 * @returns {Function} Express middleware
 */
function requireTermsAcceptance(options = {}) {
  const {
    redirectOnFailure = false,
    redirectUrl = '/terms-acceptance',
    apiResponse = true
  } = options;
  
  return async (req, res, next) => {
    try {
      // Skip if no user is authenticated
      if (!req.user) {
        return next();
      }
      
      // Get the user's ID
      const userId = req.user.id;
      
      // Get the latest terms version
      const latestTerms = await prisma.termsOfService.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' }
      });
      
      // If no terms exist yet, allow access
      if (!latestTerms) {
        return next();
      }
      
      // Check if user has accepted the latest terms
      const userTerms = await prisma.userTermsAcceptance.findFirst({
        where: {
          userId,
          termsOfServiceId: latestTerms.id
        }
      });
      
      // If user has accepted the latest terms, allow access
      if (userTerms) {
        return next();
      }
      
      // Log the terms acceptance failure
      logger.info('User has not accepted latest terms', {
        userId,
        latestTermsVersion: latestTerms.version
      });
      
      // Handle failure based on options
      if (redirectOnFailure) {
        // Redirect to terms acceptance page
        return res.redirect(redirectUrl);
      } else if (apiResponse) {
        // Return API response
        return res.status(403).json({
          status: 'error',
          message: 'Terms of service acceptance required',
          data: {
            termsRequired: true,
            termsVersion: latestTerms.version,
            termsId: latestTerms.id
          }
        });
      }
      
      // Default: block access
      return res.status(403).send('Terms of service acceptance required');
    } catch (error) {
      logger.error('Error checking terms acceptance', { error: error.message });
      
      // In case of error, allow access to avoid blocking users
      next();
    }
  };
}

/**
 * Check if user has accepted the latest terms of service for protected routes
 * 
 * @returns {Function} Express middleware
 */
function requireTermsAcceptanceForApi() {
  return requireTermsAcceptance({
    redirectOnFailure: false,
    apiResponse: true
  });
}

/**
 * Check if user has accepted the latest terms of service for web routes
 * 
 * @param {string} redirectUrl - URL to redirect to if terms not accepted
 * @returns {Function} Express middleware
 */
function requireTermsAcceptanceForWeb(redirectUrl = '/terms-acceptance') {
  return requireTermsAcceptance({
    redirectOnFailure: true,
    redirectUrl,
    apiResponse: false
  });
}

/**
 * Skip terms acceptance check for specific user roles
 * 
 * @param {Array} roles - Roles to skip terms acceptance check for
 * @returns {Function} Express middleware
 */
function skipTermsAcceptanceForRoles(roles = ['admin', 'system']) {
  return (req, res, next) => {
    // Skip if no user is authenticated
    if (!req.user) {
      return next();
    }
    
    // Skip if user has one of the specified roles
    if (req.user.role && roles.includes(req.user.role)) {
      return next();
    }
    
    // Otherwise, apply terms acceptance check
    return requireTermsAcceptanceForApi()(req, res, next);
  };
}

module.exports = {
  requireTermsAcceptance,
  requireTermsAcceptanceForApi,
  requireTermsAcceptanceForWeb,
  skipTermsAcceptanceForRoles
};
