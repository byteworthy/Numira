/**
 * Seed Terms of Service
 * 
 * This script seeds the database with initial terms of service data.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Initial terms of service data
const INITIAL_TERMS = {
  version: '1.0.0',
  effectiveDate: new Date(),
  isActive: true,
  content: fs.readFileSync(path.join(__dirname, '../TERMS_OF_SERVICE.md'), 'utf8')
};

/**
 * Seed terms of service
 */
async function seedTerms() {
  try {
    logger.info('Seeding terms of service...');
    
    // Check if terms already exist
    const existingTerms = await prisma.termsOfService.findFirst({
      where: { version: INITIAL_TERMS.version }
    });
    
    if (existingTerms) {
      logger.info('Terms of service already exist', { version: INITIAL_TERMS.version });
      return existingTerms;
    }
    
    // Create terms of service
    const terms = await prisma.termsOfService.create({
      data: INITIAL_TERMS
    });
    
    logger.info('Terms of service seeded successfully', { id: terms.id, version: terms.version });
    return terms;
  } catch (error) {
    logger.error('Error seeding terms of service', { error: error.message });
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await seedTerms();
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
  seedTerms
};
