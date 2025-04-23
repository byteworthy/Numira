/**
 * Rooms Index
 * 
 * Exports all available rooms for the Numira application.
 */

const mirrorRoom = require('./mirrorRoom');
const reframeRoom = require('./reframeRoom');
const moodBooth = require('./moodBooth');
const clarityBar = require('./clarityBar');

// Export all rooms as an object with room IDs as keys
const rooms = {
  [mirrorRoom.id]: mirrorRoom,
  [reframeRoom.id]: reframeRoom,
  [moodBooth.id]: moodBooth,
  [clarityBar.id]: clarityBar
};

// Export individual rooms and the full collection
module.exports = {
  mirrorRoom,
  reframeRoom,
  moodBooth,
  clarityBar,
  ...rooms
};
