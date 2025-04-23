/**
 * Rooms API Routes
 * 
 * Provides endpoints for retrieving room information directly from config.
 */

const express = require('express');
const router = express.Router();
const rooms = require('../../config/rooms');
const personas = require('../../config/personas');

/**
 * @route   GET /api/rooms
 * @desc    Get all rooms
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    // Sort rooms by name
    const sortedRooms = [...rooms].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    return res.json({
      status: 'success',
      data: sortedRooms,
      message: 'Rooms retrieved successfully',
      metadata: {
        count: sortedRooms.length
      }
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve rooms',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/rooms/:id
 * @desc    Get room by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get room from config
    const room = rooms.find(r => r.id === id);

    if (!room) {
      return res.status(404).json({
        status: 'error',
        message: `Room with ID ${id} not found`
      });
    }

    return res.json({
      status: 'success',
      data: room,
      message: 'Room retrieved successfully'
    });
  } catch (error) {
    console.error(`Error fetching room ${req.params.id}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve room',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/rooms/:id/compatible-personas
 * @desc    Get compatible personas for a room
 * @access  Public
 */
router.get('/:id/compatible-personas', (req, res) => {
  try {
    const { id } = req.params;

    // Get room from config
    const room = rooms.find(r => r.id === id);

    if (!room) {
      return res.status(404).json({
        status: 'error',
        message: `Room with ID ${id} not found`
      });
    }

    // Get compatible personas from config
    const compatiblePersonas = personas
      .filter(persona => room.supportedPersonas.includes(persona.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      status: 'success',
      data: compatiblePersonas,
      message: `Compatible personas for room ${id} retrieved successfully`,
      metadata: {
        count: compatiblePersonas.length,
        roomId: id
      }
    });
  } catch (error) {
    console.error(`Error fetching compatible personas for room ${req.params.id}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve compatible personas',
      error: error.message
    });
  }
});

module.exports = router;
