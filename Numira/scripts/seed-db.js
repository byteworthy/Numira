/**
 * Seed Database
 * 
 * This script seeds the database with initial data.
 * It runs all the individual seed scripts.
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { seedTerms } = require('./seed-terms');

const prisma = new PrismaClient();

/**
 * Seed database with initial data
 */
async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // Seed terms of service
    await seedTerms();
    
    // Add other seed functions here
    // await seedUsers();
    // await seedPersonas();
    // await seedRooms();
    // etc.
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding database', { error: error.message });
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await seedDatabase();
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Seeding failed', { error: error.message });
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  seedDatabase
};
