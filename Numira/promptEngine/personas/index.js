/**
 * Personas Index
 * 
 * Exports all available personas for the Numira application.
 */

const ayla = require('./ayla');
const cam = require('./cam');
const jax = require('./jax');
const rumi = require('./rumi');

// Export all personas as an object with persona IDs as keys
const personas = {
  [ayla.id]: ayla,
  [cam.id]: cam,
  [jax.id]: jax,
  [rumi.id]: rumi
};

// Export individual personas and the full collection
module.exports = {
  ayla,
  cam,
  jax,
  rumi,
  ...personas
};
