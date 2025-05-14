/**
 * Jest Global Teardown
 * 
 * This file runs once after all tests and cleans up the global test environment.
 * It includes cleaning up the test database and other global resources.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

// Create a Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Clean up the test environment
 */
module.exports = async () => {
  console.log('\n🧹 Cleaning up test environment...');
  
  try {
    // Connect to the database
    await prisma.$connect();
    
    // Clean up test data if needed
    // This could include removing test data from the database
    // that was created during the tests
    
    // Clean up test uploads directory
    const testUploadsDir = path.join(__dirname, '../uploads/test');
    if (fs.existsSync(testUploadsDir)) {
      // Use rimraf to recursively remove the directory
      rimraf.sync(testUploadsDir);
      console.log('✅ Cleaned up test uploads directory');
    }
    
    // Clean up any other test resources
    
    // Clean up global mocks
    delete global.__TEST_ENV_SETUP_COMPLETE__;
    
    console.log('✅ Test environment cleanup complete\n');
  } catch (error) {
    console.error('❌ Error cleaning up test environment:', error);
    throw error;
  } finally {
    // Disconnect from the database
    await prisma.$disconnect();
  }
};
