/**
 * Jest Global Setup
 * 
 * This file runs once before all tests and sets up the global test environment.
 * It includes setting up the test database and other global resources.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Create a Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Set up the test environment
 */
module.exports = async () => {
  console.log('\n🚀 Setting up test environment...');
  
  try {
    // Ensure we're using the test database
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('test')) {
      throw new Error('Test database URL not configured correctly. Make sure DATABASE_URL in .env.test includes "test"');
    }
    
    // Connect to the database
    await prisma.$connect();
    console.log('✅ Connected to test database');
    
    // Create test directories if they don't exist
    const testUploadsDir = path.join(__dirname, '../uploads/test');
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
      console.log('✅ Created test uploads directory');
    }
    
    // Set up test data if needed
    // This could include seeding the database with test data
    // that is required for all tests
    
    // Set up global mocks
    global.__TEST_ENV_SETUP_COMPLETE__ = true;
    
    console.log('✅ Test environment setup complete\n');
  } catch (error) {
    console.error('❌ Error setting up test environment:', error);
    throw error;
  } finally {
    // Disconnect from the database
    await prisma.$disconnect();
  }
};
