const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// @route   GET api/personas
// @desc    Get all personas
// @access  Public
router.get('/', async (req, res) => {
  console.log('GET /api/personas route accessed');
  try {
    console.log('Attempting database query');
    const result = await db.query('SELECT * FROM personas');
    console.log('Query completed, rows returned:', result.rows.length);
    console.log('Data:', JSON.stringify(result.rows));
    res.json(result.rows);
  } catch (err) {
    console.error('DATABASE QUERY ERROR:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/personas/:id
// @desc    Get persona by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM personas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Persona not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
module.exports = router;