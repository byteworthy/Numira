#!/usr/bin/env node

/**
 * Test Environment Setup Script
 * 
 * This script sets up the test environment by:
 * 1. Creating the test database if it doesn't exist
 * 2. Running migrations to set up the schema
 * 3. Seeding the database with test data
 * 
 * Usage:
 *   node scripts/setup-test-env.js [options]
 * 
 * Options:
 *   --reset     Reset the test database (drop and recreate)
 *   --seed      Seed the database with test data
 *   --help      Show help
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Client } = require('pg');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  reset: args.includes('--reset'),
  seed: args.includes('--seed'),
  help: args.includes('--help')
};

// Show help if requested
if (options.help) {
  console.log(`
Test Environment Setup Script

This script sets up the test environment by:
1. Creating the test database if it doesn't exist
2. Running migrations to set up the schema
3. Seeding the database with test data

Usage:
  node scripts/setup-test-env.js [options]

Options:
  --reset     Reset the test database (drop and recreate)
  --seed      Seed the database with test data
  --help      Show help
  `);
  process.exit(0);
}

// Extract database connection info from DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env.test');
  process.exit(1);
}

// Parse the database URL
const dbUrlRegex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
const dbUrlMatch = dbUrl.match(dbUrlRegex);

if (!dbUrlMatch) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, dbUser, dbPassword, dbHost, dbPort, dbName] = dbUrlMatch;

// Connect to PostgreSQL server (without specifying a database)
const pgClient = new Client({
  user: dbUser,
  password: dbPassword,
  host: dbHost,
  port: dbPort,
  database: 'postgres' // Connect to default postgres database
});

/**
 * Create the test database
 */
async function createTestDatabase() {
  try {
    await pgClient.connect();
    
    // Check if database exists
    const checkResult = await pgClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    
    if (checkResult.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`🔧 Creating test database: ${dbName}`);
      await pgClient.query(`CREATE DATABASE ${dbName}`);
      console.log('✅ Test database created');
    } else if (options.reset) {
      // Database exists and reset option is enabled
      console.log(`🔄 Resetting test database: ${dbName}`);
      
      // Terminate all connections to the database
      await pgClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${dbName}'
        AND pid <> pg_backend_pid()
      `);
      
      // Drop and recreate the database
      await pgClient.query(`DROP DATABASE ${dbName}`);
      await pgClient.query(`CREATE DATABASE ${dbName}`);
      console.log('✅ Test database reset complete');
    } else {
      console.log(`✅ Test database already exists: ${dbName}`);
    }
  } catch (error) {
    console.error('❌ Error creating/resetting test database:', error);
    throw error;
  } finally {
    await pgClient.end();
  }
}

/**
 * Run database migrations
 */
async function runMigrations() {
  console.log('🔧 Running database migrations...');
  
  try {
    // Use Prisma to run migrations
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit'
    });
    
    console.log('✅ Database migrations complete');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    throw error;
  }
}

/**
 * Seed the database with test data
 */
async function seedDatabase() {
  if (!options.seed && !options.reset) {
    console.log('ℹ️ Skipping database seeding (use --seed to seed the database)');
    return;
  }
  
  console.log('🔧 Seeding database with test data...');
  
  try {
    // Run the seed script
    execSync('node scripts/seed.js --test', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit'
    });
    
    console.log('✅ Database seeding complete');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

/**
 * Create test uploads directory
 */
function createTestUploadsDirectory() {
  const testUploadsDir = path.join(__dirname, '../uploads/test');
  
  if (!fs.existsSync(testUploadsDir)) {
    console.log('🔧 Creating test uploads directory...');
    fs.mkdirSync(testUploadsDir, { recursive: true });
    console.log('✅ Test uploads directory created');
  } else {
    console.log('✅ Test uploads directory already exists');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n🚀 Setting up test environment...');
  
  try {
    // Create test database
    await createTestDatabase();
    
    // Run migrations
    await runMigrations();
    
    // Seed database
    await seedDatabase();
    
    // Create test uploads directory
    createTestUploadsDirectory();
    
    console.log('\n✅ Test environment setup complete\n');
  } catch (error) {
    console.error('\n❌ Test environment setup failed\n');
    process.exit(1);
  }
}

// Run the main function
main();
