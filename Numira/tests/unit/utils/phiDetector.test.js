/**
 * Unit Tests for PHI Detector Utility
 */

const {
  sanitizeInput,
  containsPHI,
  getPHIDetectionMessage,
  logPHIDetection,
  analyzeRisk,
  PHI_PATTERNS
} = require('../../../utils/phiDetector');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('PHI Detector Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PHI_PATTERNS', () => {
    it('should define patterns for various PHI types', () => {
      expect(PHI_PATTERNS).toBeDefined();
      expect(PHI_PATTERNS.ssn).toBeDefined();
      expect(PHI_PATTERNS.name).toBeDefined();
      expect(PHI_PATTERNS.address).toBeDefined();
      expect(PHI_PATTERNS.email).toBeDefined();
      expect(PHI_PATTERNS.phone).toBeDefined();
      expect(PHI_PATTERNS.medicalRecord).toBeDefined();
      expect(PHI_PATTERNS.insurance).toBeDefined();
      expect(PHI_PATTERNS.dob).toBeDefined();
    });

    it('should correctly match SSN patterns', () => {
      const pattern = PHI_PATTERNS.ssn;
      expect(pattern.test('123-45-6789')).toBe(true);
      expect(pattern.test('123456789')).toBe(true);
      expect(pattern.test('12-34-5678')).toBe(false); // Wrong format
      expect(pattern.test('12345')).toBe(false); // Too short
    });

    it('should correctly match name patterns', () => {
      const pattern = PHI_PATTERNS.name;
      expect(pattern.test('John Doe')).toBe(true);
      expect(pattern.test('john doe')).toBe(false); // Not capitalized
      expect(pattern.test('John')).toBe(false); // No last name
    });

    it('should correctly match address patterns', () => {
      const pattern = PHI_PATTERNS.address;
      expect(pattern.test('123 Main Street')).toBe(true);
      expect(pattern.test('456 Park Avenue')).toBe(true);
      expect(pattern.test('789 Oak Dr.')).toBe(true);
      expect(pattern.test('Main Street')).toBe(false); // No number
    });

    it('should correctly match email patterns', () => {
      const pattern = PHI_PATTERNS.email;
      expect(pattern.test('user@example.com')).toBe(true);
      expect(pattern.test('john.doe@company.co.uk')).toBe(true);
      expect(pattern.test('invalid-email')).toBe(false);
    });

    it('should correctly match phone number patterns', () => {
      const pattern = PHI_PATTERNS.phone;
      expect(pattern.test('123-456-7890')).toBe(true);
      expect(pattern.test('(123) 456-7890')).toBe(true);
      expect(pattern.test('+1 123 456 7890')).toBe(true);
      expect(pattern.test('12345')).toBe(false); // Too short
    });

    it('should correctly match date of birth patterns', () => {
      const pattern = PHI_PATTERNS.dob;
      expect(pattern.test('01/02/1990')).toBe(true);
      expect(pattern.test('1/2/1990')).toBe(true);
      expect(pattern.test('01-02-1990')).toBe(true);
      expect(pattern.test('01/02/90')).toBe(false); // Two-digit year
    });
  });

  describe('sanitizeInput', () => {
    it('should return empty string for null or undefined input', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeInput(123)).toBe('');
      expect(sanitizeInput({})).toBe('');
      expect(sanitizeInput([])).toBe('');
    });

    it('should trim and normalize whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('multiple    spaces')).toBe('multiple spaces');
    });

    it('should redact SSN', () => {
      expect(sanitizeInput('My SSN is 123-45-6789')).toBe('My SSN is [REDACTED ID]');
      expect(sanitizeInput('SSN: 123456789')).toBe('SSN: [REDACTED ID]');
    });

    it('should redact email addresses', () => {
      expect(sanitizeInput('Contact me at user@example.com')).toBe('Contact me at [REDACTED EMAIL]');
    });

    it('should redact phone numbers', () => {
      expect(sanitizeInput('Call me at 123-456-7890')).toBe('Call me at [REDACTED PHONE]');
      expect(sanitizeInput('Phone: (123) 456-7890')).toBe('Phone: [REDACTED PHONE]');
    });

    it('should redact addresses', () => {
      expect(sanitizeInput('I live at 123 Main Street')).toBe('I live at [REDACTED ADDRESS]');
    });

    it('should redact medical record numbers', () => {
      expect(sanitizeInput('MRN: 1234567890')).toBe('MRN: [REDACTED MEDICAL ID]');
    });

    it('should redact insurance numbers', () => {
      expect(sanitizeInput('Policy #: 123456789012')).toBe('Policy #: [REDACTED INSURANCE]');
    });

    it('should redact dates of birth', () => {
      expect(sanitizeInput('DOB: 01/02/1990')).toBe('DOB: [REDACTED DOB]');
    });

    it('should handle multiple PHI types in one string', () => {
      const input = 'John Doe, 123-45-6789, john@example.com, 123 Main St';
      const expected = 'John Doe, [REDACTED ID], [REDACTED EMAIL], [REDACTED ADDRESS]';
      expect(sanitizeInput(input)).toBe(expected);
    });
  });

  describe('containsPHI', () => {
    it('should return false for null or undefined input', () => {
      expect(containsPHI(null)).toBe(false);
      expect(containsPHI(undefined)).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(containsPHI(123)).toBe(false);
      expect(containsPHI({})).toBe(false);
    });

    it('should return false for text without PHI', () => {
      expect(containsPHI('This is a normal message without PHI')).toBe(false);
    });

    it('should return true for text with SSN', () => {
      expect(containsPHI('My SSN is 123-45-6789')).toBe(true);
    });

    it('should return true for text with email', () => {
      expect(containsPHI('Contact me at user@example.com')).toBe(true);
    });

    it('should return true for text with phone number', () => {
      expect(containsPHI('Call me at 123-456-7890')).toBe(true);
    });

    it('should return true for text with address', () => {
      expect(containsPHI('I live at 123 Main Street')).toBe(true);
    });

    it('should return true for text with medical context', () => {
      expect(containsPHI('I was diagnosed with diabetes')).toBe(true);
    });
  });

  describe('getPHIDetectionMessage', () => {
    it('should return input-specific message', () => {
      const message = getPHIDetectionMessage('input');
      expect(message).toContain('privacy and security');
      expect(message).toContain('avoid sharing personal identifiable information');
    });

    it('should return journal-specific message', () => {
      const message = getPHIDetectionMessage('journal');
      expect(message).toContain('journal entries cannot contain personal identifiers');
    });

    it('should return default message for unknown context', () => {
      const message = getPHIDetectionMessage('unknown');
      expect(message).toContain('Personal identifiable information detected');
    });

    it('should return default message when no context provided', () => {
      const message = getPHIDetectionMessage();
      expect(message).toContain('Personal identifiable information detected');
    });
  });

  describe('logPHIDetection', () => {
    it('should log PHI detection with source', () => {
      logPHIDetection('test-service');
      
      expect(logger.warn).toHaveBeenCalledWith('Potential PHI detected and blocked', {
        source: 'test-service',
        timestamp: expect.any(String)
      });
    });

    it('should include additional metadata in log', () => {
      const metadata = { userId: '123', requestId: 'abc' };
      logPHIDetection('test-service', metadata);
      
      expect(logger.warn).toHaveBeenCalledWith('Potential PHI detected and blocked', {
        source: 'test-service',
        timestamp: expect.any(String),
        userId: '123',
        requestId: 'abc'
      });
    });
  });

  describe('analyzeRisk', () => {
    it('should return no risk for null or undefined input', () => {
      expect(analyzeRisk(null)).toEqual({ risk: 'none', matches: 0, patterns: [] });
      expect(analyzeRisk(undefined)).toEqual({ risk: 'none', matches: 0, patterns: [] });
    });

    it('should return no risk for non-string input', () => {
      expect(analyzeRisk(123)).toEqual({ risk: 'none', matches: 0, patterns: [] });
      expect(analyzeRisk({})).toEqual({ risk: 'none', matches: 0, patterns: [] });
    });

    it('should return no risk for text without PHI', () => {
      const result = analyzeRisk('This is a normal message without PHI');
      expect(result.risk).toBe('none');
      expect(result.matches).toBe(0);
      expect(result.patterns).toEqual([]);
    });

    it('should return moderate risk for text with one PHI pattern', () => {
      const result = analyzeRisk('My SSN is 123-45-6789');
      expect(result.risk).toBe('moderate');
      expect(result.matches).toBe(1);
      expect(result.patterns).toContain('ssn');
    });

    it('should return high risk for text with multiple PHI patterns', () => {
      const result = analyzeRisk('John Doe, 123-45-6789, diagnosed with diabetes');
      expect(result.risk).toBe('high');
      expect(result.matches).toBeGreaterThan(2);
      expect(result.patterns).toContain('name');
      expect(result.patterns).toContain('ssn');
      expect(result.patterns).toContain('medicalCondition');
    });

    it('should identify all matching patterns', () => {
      const result = analyzeRisk('John Doe, 123-45-6789, john@example.com, 123 Main St');
      expect(result.patterns).toContain('name');
      expect(result.patterns).toContain('ssn');
      expect(result.patterns).toContain('email');
      expect(result.patterns).toContain('address');
    });
  });
});
