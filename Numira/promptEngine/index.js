/**
 * Prompt Engine Index
 * 
 * Main entry point for the Numira prompt engine.
 * Exports personas, rooms, and utility functions for generating prompts.
 */

const personas = require('./personas');
const rooms = require('./rooms');
const systemPromptTemplate = require('./systemPromptTemplate');

/**
 * Generate a system prompt for a specific persona and room
 * 
 * @param {string} personaId - ID of the persona
 * @param {string} roomId - ID of the room
 * @param {Object} options - Additional options for prompt generation
 * @returns {string} The generated system prompt
 */
function generateSystemPrompt(personaId, roomId, options = {}) {
  // Get the persona and room
  const persona = personas[personaId];
  const room = rooms[roomId];
  
  if (!persona) {
    throw new Error(`Persona not found: ${personaId}`);
  }
  
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }
  
  // Check compatibility
  if (!room.compatiblePersonas.includes(personaId)) {
    throw new Error(`Persona ${personaId} is not compatible with room ${roomId}`);
  }
  
  // Generate the system prompt using the template
  return systemPromptTemplate.generate({
    persona,
    room,
    ...options
  });
}

/**
 * Get all available personas
 * 
 * @returns {Object[]} Array of persona objects
 */
function getAllPersonas() {
  return Object.values(personas).filter(p => p.id);
}

/**
 * Get all available rooms
 * 
 * @returns {Object[]} Array of room objects
 */
function getAllRooms() {
  return Object.values(rooms).filter(r => r.id);
}

/**
 * Get compatible rooms for a persona
 * 
 * @param {string} personaId - ID of the persona
 * @returns {Object[]} Array of compatible room objects
 */
function getCompatibleRoomsForPersona(personaId) {
  const persona = personas[personaId];
  if (!persona) {
    throw new Error(`Persona not found: ${personaId}`);
  }
  
  return Object.values(rooms)
    .filter(room => room.compatiblePersonas.includes(personaId));
}

/**
 * Get compatible personas for a room
 * 
 * @param {string} roomId - ID of the room
 * @returns {Object[]} Array of compatible persona objects
 */
function getCompatiblePersonasForRoom(roomId) {
  const room = rooms[roomId];
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }
  
  return Object.values(personas)
    .filter(persona => room.compatiblePersonas.includes(persona.id));
}

module.exports = {
  personas,
  rooms,
  generateSystemPrompt,
  getAllPersonas,
  getAllRooms,
  getCompatibleRoomsForPersona,
  getCompatiblePersonasForRoom
};
