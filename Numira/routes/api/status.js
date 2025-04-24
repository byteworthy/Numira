const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/status/health
 * @desc    Health check for status API
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ status: "ok", message: "status API healthy" });
});

/**
 * @route   GET /api/status
 * @desc    Get status placeholder
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({ data: [], message: "status API placeholder" });
});

module.exports = router;
