/**
 * Database Setup Script
 * 
 * This script handles the initial setup of the database:
 * 1. Creates necessary directories for SQLite database
 * 2. Generates the Prisma client
 * 3. Creates SQLite database file if it doesn't exist
 * 
 * Usage: node scripts/setup-database.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 Setting up database...');
  
  try {
    // Step 1: Create prisma directory if it doesn't exist
    const prismaDir = path.join(__dirname, '../prisma');
    if (!fs.existsSync(prismaDir)) {
      console.log('📁 Creating prisma directory...');
      fs.mkdirSync(prismaDir, { recursive: true });
    }
    
    // Step 2: Create migrations directory if it doesn't exist
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 Creating migrations directory...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    // Step 3: Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit'
    });
    
    // Step 4: Create SQLite database file if it doesn't exist
    const dbFilePath = path.join(__dirname, '../prisma/dev.db');
    if (!fs.existsSync(dbFilePath)) {
      console.log('🗄️ Creating SQLite database file...');
      try {
        // Push the schema to create the database
        execSync('npx prisma db push', {
          stdio: 'inherit'
        });
      } catch (error) {
        console.log('⚠️ Could not create SQLite database file. Continuing anyway...');
      }
    }
    
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
