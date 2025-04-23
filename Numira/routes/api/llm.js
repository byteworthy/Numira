/**
 * LLM Provider API Routes
 * 
 * Provides endpoints for LLM provider status and management.
 */

const express = require('express');
const router = express.Router();
const llmProviderService = require('../../services/llmProviderService');
const circuitBreaker = require('../../services/circuitBreaker');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

/**
 * @route   GET /api/llm/status
 * @desc    Get status of all LLM providers
 * @access  Private (Admin)
 */
router.get('/status', auth, roleCheck(['admin']), async (req, res) => {
  try {
    const providerStatus = llmProviderService.getProviderStatus();
    const breakerStatus = circuitBreaker.getAllBreakers();
    
    res.json({
      providers: providerStatus,
      circuitBreakers: breakerStatus
    });
  } catch (error) {
    console.error('Error getting LLM status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/llm/reset/:provider
 * @desc    Reset circuit breaker for a specific provider
 * @access  Private (Admin)
 */
router.post('/reset/:provider', auth, roleCheck(['admin']), async (req, res) => {
  try {
    const { provider } = req.params;
    
    if (!provider) {
      return res.status(400).json({ message: 'Provider name is required' });
    }
    
    const result = circuitBreaker.resetBreaker(provider);
    
    if (result) {
      res.json({ message: `Circuit breaker for ${provider} reset successfully` });
    } else {
      res.status(404).json({ message: `Circuit breaker for ${provider} not found` });
    }
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/llm/reset-all
 * @desc    Reset all circuit breakers
 * @access  Private (Admin)
 */
router.post('/reset-all', auth, roleCheck(['admin']), async (req, res) => {
  try {
    circuitBreaker.resetAllBreakers();
    res.json({ message: 'All circuit breakers reset successfully' });
  } catch (error) {
    console.error('Error resetting all circuit breakers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/llm/metrics
 * @desc    Get LLM usage metrics
 * @access  Private (Admin)
 */
router.get('/metrics', auth, roleCheck(['admin']), async (req, res) => {
  try {
    // This would typically come from a metrics tracking service
    // For now, we'll return some basic information
    res.json({
      message: 'LLM metrics endpoint - to be implemented with actual metrics tracking'
    });
  } catch (error) {
    console.error('Error getting LLM metrics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
