/**
 * Database Setup Script
 * 
 * This script handles the initial setup of the database:
 * 1. Creates a baseline migration from the existing database schema
 * 2. Generates the Prisma client
 * 
 * Usage: node scripts/setup-database.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 Setting up database...');
  
  try {
    // Step 1: Create migrations directory if it doesn't exist
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 Creating migrations directory...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    // Step 2: Create a baseline migration
    console.log('🏗️ Creating baseline migration from existing database...');
    try {
      execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/init/migration.sql', {
        stdio: 'inherit'
      });
    } catch (error) {
      console.log('⚠️ Could not create baseline migration. This might be expected if the database is already set up.');
      console.log('⚠️ Continuing with client generation...');
    }
    
    // Step 3: Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit'
    });
    
    console.log('✅ Database setup completed successfully!');
    console.log('You can now run:');
    console.log('  - npm install (to install dependencies)');
    console.log('  - node scripts/seed.js (to seed the database)');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error during database setup:', error);
    process.exit(1);
  });
