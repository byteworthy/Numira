/**
 * Personas API Routes
 * 
 * Provides endpoints for retrieving persona information directly from config.
 */

const express = require('express');
const router = express.Router();
const personas = require('../../config/personas');
const rooms = require('../../config/rooms');

/**
 * @route   GET /api/personas
 * @desc    Get all personas
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    // Sort personas by name
    const sortedPersonas = [...personas].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    return res.json({
      status: 'success',
      data: sortedPersonas,
      message: 'Personas retrieved successfully',
      metadata: {
        count: sortedPersonas.length
      }
    });
  } catch (error) {
    console.error('Error fetching personas:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve personas',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/personas/:id
 * @desc    Get persona by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get persona from config
    const persona = personas.find(p => p.id === id);

    if (!persona) {
      return res.status(404).json({
        status: 'error',
        message: `Persona with ID ${id} not found`
      });
    }

    return res.json({
      status: 'success',
      data: persona,
      message: 'Persona retrieved successfully'
    });
  } catch (error) {
    console.error(`Error fetching persona ${req.params.id}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve persona',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/personas/:id/compatible-rooms
 * @desc    Get compatible rooms for a persona
 * @access  Public
 */
router.get('/:id/compatible-rooms', (req, res) => {
  try {
    const { id } = req.params;

    // Get persona from config
    const persona = personas.find(p => p.id === id);

    if (!persona) {
      return res.status(404).json({
        status: 'error',
        message: `Persona with ID ${id} not found`
      });
    }

    // Get compatible rooms from config
    const compatibleRooms = rooms.filter(room => 
      room.supportedPersonas.includes(id)
    ).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      status: 'success',
      data: compatibleRooms,
      message: `Compatible rooms for persona ${id} retrieved successfully`,
      metadata: {
        count: compatibleRooms.length,
        personaId: id
      }
    });
  } catch (error) {
    console.error(`Error fetching compatible rooms for persona ${req.params.id}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve compatible rooms',
      error: error.message
    });
  }
});

module.exports = router;
