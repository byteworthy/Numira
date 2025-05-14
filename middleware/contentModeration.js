/**
 * Content Moderation Middleware
 * 
 * Ensures all user-generated content adheres to ethical guidelines and
 * promotes a safe, supportive environment. This middleware is a cornerstone
 * of Numira's commitment to user well-being and ethical AI interaction.
 * 
 * The moderation system uses a multi-layered approach to detect and filter:
 * - Harmful or abusive language
 * - Self-harm or suicidal content (with appropriate response protocols)
 * - Personally identifiable information (PII)
 * - Protected health information (PHI)
 * - Content that could trigger distress
 * 
 * When concerning content is detected, the system can:
 * 1. Block the content with an explanation
 * 2. Trigger emergency protocols for crisis situations
 * 3. Log the incident for review (without storing sensitive information)
 * 4. Provide supportive resources to the user
 */

const logger = require('../utils/logger');
const config = require('../config/config');

// Import PHI detector utility
const phiDetector = require('../utils/phiDetector');

// Patterns for detecting concerning content
const PATTERNS = {
  SELF_HARM: /\b(suicid(e|al)|kill (myself|me)|end my life|harm (myself|me)|hurt (myself|me)|don't want to (live|be alive)|can't go on)\b/i,
  ABUSE: /\b(abuse|assault|attack|beat|hit|hurt|molest|rape|victim)\b/i,
  EMERGENCY: /\b(emergency|urgent|immediate help|crisis|danger|unsafe)\b/i,
  PII: /\b(\d{3}[-\.\s]??\d{2}[-\.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-\.\s]??\d{4}|\d{3}[-\.\s]??\d{4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4})\b/i
};

// Crisis resources to provide when concerning content is detected
const CRISIS_RESOURCES = {
  US: {
    SUICIDE_PREVENTION: '988 - Suicide & Crisis Lifeline (call or text)',
    CRISIS_TEXT: 'Text HOME to 741741 to reach the Crisis Text Line',
    DOMESTIC_VIOLENCE: '1-800-799-7233 - National Domestic Violence Hotline'
  },
  INTERNATIONAL: {
    RESOURCES: 'https://findahelpline.com/i/iasp'
  }
};

/**
 * Checks content for concerning patterns and PHI
 * @param {String} content - The content to check
 * @returns {Object} - Result with flags for different types of concerning content
 */
const analyzeContent = (content) => {
  if (!content || typeof content !== 'string') {
    return { safe: true };
  }

  const result = {
    safe: true,
    selfHarm: false,
    abuse: false,
    emergency: false,
    pii: false,
    phi: false
  };

  // Check for concerning patterns
  result.selfHarm = PATTERNS.SELF_HARM.test(content);
  result.abuse = PATTERNS.ABUSE.test(content);
  result.emergency = PATTERNS.EMERGENCY.test(content);
  result.pii = PATTERNS.PII.test(content);
  
  // Check for PHI using the PHI detector utility
  result.phi = phiDetector.containsPHI(content);
  
  // Update safe flag if any concerning content is detected
  if (result.selfHarm || result.abuse || result.emergency || result.pii || result.phi) {
    result.safe = false;
  }

  return result;
};

/**
 * Generates an appropriate response based on content analysis
 * @param {Object} analysis - The content analysis result
 * @returns {Object} - Response with message and action
 */
const generateResponse = (analysis) => {
  if (analysis.safe) {
    return { allow: true };
  }

  const response = {
    allow: false,
    message: 'Your message contains content that requires attention.',
    resources: null,
    action: 'block'
  };

  // Prioritize self-harm as the most critical concern
  if (analysis.selfHarm) {
    response.message = 'We noticed your message may indicate thoughts of self-harm. Your well-being is important to us.';
    response.resources = CRISIS_RESOURCES;
    response.action = 'crisis_protocol';
    return response;
  }

  // Handle abuse-related content
  if (analysis.abuse) {
    response.message = 'We noticed your message may reference abuse or harm. If you need support, resources are available.';
    response.resources = CRISIS_RESOURCES;
    return response;
  }

  // Handle emergency situations
  if (analysis.emergency) {
    response.message = 'If you are experiencing an emergency, please contact emergency services immediately.';
    response.resources = CRISIS_RESOURCES;
    response.action = 'suggest_emergency_services';
    return response;
  }

  // Handle PII/PHI with privacy-focused message
  if (analysis.pii || analysis.phi) {
    response.message = 'For your privacy and security, please avoid sharing personal or health information.';
    response.action = 'privacy_warning';
    return response;
  }

  return response;
};

/**
 * Express middleware to moderate user-generated content
 */
module.exports = (req, res, next) => {
  // Skip moderation for non-content routes
  const contentRoutes = [
    '/api/ai/respond',
    '/api/conversations',
    '/api/journals',
    '/api/feedback'
  ];
  
  if (!contentRoutes.some(route => req.path.includes(route))) {
    return next();
  }
  
  // Extract content from request based on route
  let content = '';
  
  if (req.path.includes('/api/ai/respond') && req.body.message) {
    content = req.body.message;
  } else if (req.path.includes('/api/conversations') && req.body.content) {
    content = req.body.content;
  } else if (req.path.includes('/api/journals') && req.body.content) {
    content = req.body.content;
  } else if (req.path.includes('/api/feedback') && req.body.feedback) {
    content = req.body.feedback;
  }
  
  if (!content) {
    return next();
  }
  
  // Analyze content
  const analysis = analyzeContent(content);
  
  // If content is safe, proceed
  if (analysis.safe) {
    return next();
  }
  
  // Generate appropriate response
  const response = generateResponse(analysis);
  
  // Log the moderation event (without storing the actual content)
  logger.info('Content moderation triggered', {
    path: req.path,
    userId: req.user ? req.user.id : 'unauthenticated',
    action: response.action,
    selfHarm: analysis.selfHarm,
    abuse: analysis.abuse,
    emergency: analysis.emergency,
    pii: analysis.pii,
    phi: analysis.phi
  });
  
  // Handle based on action
  if (response.action === 'crisis_protocol' && config.ENABLE_CRISIS_PROTOCOLS) {
    // In a production environment, this would trigger appropriate crisis protocols
    // such as escalation to human review or emergency services if configured
    logger.warn('Crisis protocol triggered', {
      userId: req.user ? req.user.id : 'unauthenticated'
    });
  }
  
  // Return appropriate response to client
  return res.status(403).json({
    success: false,
    message: response.message,
    resources: response.resources,
    action: response.action
  });
};
