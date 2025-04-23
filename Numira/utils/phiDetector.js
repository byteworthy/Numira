/**
 * PHI Detector Utility
 * 
 * Centralized utility for detecting and handling Personal Health Information (PHI).
 * This module provides functions to detect, sanitize, and handle PHI in user inputs
 * to ensure compliance with privacy regulations.
 * 
 * IMPORTANT: This is not a comprehensive PHI detection solution and should be
 * supplemented with additional measures for full compliance.
 */

const winston = require('winston');
const logger = require('./logger');

/**
 * Regular expressions for detecting potential PHI
 */
const PHI_PATTERNS = {
  // Social Security Number patterns (e.g., 123-45-6789, 123456789)
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
  
  // Name patterns (looking for potential full names)
  name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/,
  
  // Address-like patterns
  address: /\b\d+\s+[A-Za-z\s]+(?:Avenue|Lane|Road|Boulevard|Drive|Street|Ave|Dr|Rd|Blvd|Ln|St)\.?\b/i,
  
  // Email patterns
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  
  // Phone number patterns
  phone: /\b(?:\+\d{1,2}\s)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  
  // Medical record numbers (common formats)
  medicalRecord: /\b(?:MR|MRN|#)?\s*\d{6,10}\b/i,
  
  // Health insurance numbers
  insurance: /\b(?:Policy|Group|Member|#)?\s*\d{6,12}\b/i,
  
  // Date of birth patterns
  dob: /\b(?:0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/,
  
  // Age patterns when combined with health context
  age: /\b(?:I am|I'm|age[d]?|[0-9]{1,3} years old)\b/i,
  
  // Common medical condition mentions
  medicalCondition: /\b(?:diagnosed with|suffering from|I have|medication for)\b/i
};

/**
 * Sanitizes user input to remove potentially sensitive information
 * 
 * @param {string} input - The user's raw input text
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Basic sanitization - remove excessive whitespace
  let sanitized = input.trim().replace(/\s+/g, ' ');
  
  // Remove common PII patterns
  sanitized = sanitized
    .replace(PHI_PATTERNS.ssn, '[REDACTED ID]')
    .replace(PHI_PATTERNS.email, '[REDACTED EMAIL]')
    .replace(PHI_PATTERNS.phone, '[REDACTED PHONE]')
    .replace(PHI_PATTERNS.address, '[REDACTED ADDRESS]')
    .replace(PHI_PATTERNS.medicalRecord, '[REDACTED MEDICAL ID]')
    .replace(PHI_PATTERNS.insurance, '[REDACTED INSURANCE]')
    .replace(PHI_PATTERNS.dob, '[REDACTED DOB]');
  
  return sanitized;
}

/**
 * Checks if the input contains potential PHI
 * 
 * @param {string} input - The user's input text
 * @returns {boolean} - True if potential PHI is detected
 */
function containsPHI(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  // Check against all PHI patterns
  return Object.values(PHI_PATTERNS).some(pattern => pattern.test(input));
}

/**
 * Get a user-friendly message when PHI is detected
 * 
 * @param {string} context - The context where PHI was detected ('input', 'journal', etc.)
 * @returns {string} - User-friendly message
 */
function getPHIDetectionMessage(context) {
  const messages = {
    input: 'For your privacy and security, please avoid sharing personal identifiable information like full names, addresses, phone numbers, or medical record numbers. I\'m here to help, but I cannot process or store personal health information.',
    journal: 'For your privacy, journal entries cannot contain personal identifiers like names, addresses, or ID numbers.',
    default: 'Personal identifiable information detected. Please avoid sharing sensitive personal details.'
  };
  
  return messages[context] || messages.default;
}

/**
 * Log PHI detection events for security monitoring
 * 
 * @param {string} source - The source of the detection (service name)
 * @param {Object} metadata - Additional metadata about the detection
 */
function logPHIDetection(source, metadata = {}) {
  logger.warn('Potential PHI detected and blocked', {
    source,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * Analyze text for PHI risk level
 * 
 * @param {string} text - The text to analyze
 * @returns {Object} - Risk assessment
 */
function analyzeRisk(text) {
  if (!text || typeof text !== 'string') {
    return { risk: 'none', matches: 0, patterns: [] };
  }
  
  const matches = [];
  let matchCount = 0;
  
  // Check each pattern
  for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
    if (pattern.test(text)) {
      matches.push(type);
      matchCount++;
    }
  }
  
  // Determine risk level
  let risk = 'none';
  if (matchCount > 2) {
    risk = 'high';
  } else if (matchCount > 0) {
    risk = 'moderate';
  }
  
  return {
    risk,
    matches: matchCount,
    patterns: matches
  };
}

module.exports = {
  sanitizeInput,
  containsPHI,
  getPHIDetectionMessage,
  logPHIDetection,
  analyzeRisk,
  PHI_PATTERNS
};
