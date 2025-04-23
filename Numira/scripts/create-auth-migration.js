/**
 * Authentication Migration Script
 * 
 * This script creates a migration to add authentication fields to the User model.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

// Ensure the prisma directory exists
const prismaDir = path.join(__dirname, '..', 'prisma');
if (!fs.existsSync(prismaDir)) {
  fs.mkdirSync(prismaDir, { recursive: true });
}

// Check if schema.prisma exists
const schemaPath = path.join(prismaDir, 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  logger.error('schema.prisma not found. Please create it first.');
  process.exit(1);
}

// Read the current schema
let schema = fs.readFileSync(schemaPath, 'utf8');

// Check if authentication fields already exist
if (schema.includes('passwordHash') && schema.includes('salt')) {
  logger.info('Authentication fields already exist in the User model.');
  process.exit(0);
}

// Add authentication fields to User model if they don't exist
if (!schema.includes('passwordHash')) {
  // Find the User model
  const userModelRegex = /model\s+User\s+{[^}]+}/g;
  const userModel = schema.match(userModelRegex);

  if (!userModel) {
    logger.error('User model not found in schema.prisma');
    process.exit(1);
  }

  // Add authentication fields
  const updatedUserModel = userModel[0].replace(
    /(\s+id\s+.+\n)/,
    '$1  passwordHash  String?\n  salt          String?\n'
  );

  // Replace the old User model with the updated one
  schema = schema.replace(userModelRegex, updatedUserModel);

  // Write the updated schema back to the file
  fs.writeFileSync(schemaPath, schema);
  logger.info('Added authentication fields to User model in schema.prisma');
}

// Create a migration
try {
  logger.info('Creating migration...');
  execSync('npx prisma migrate dev --name add_authentication_fields', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  logger.info('Migration created successfully');
} catch (error) {
  logger.error('Failed to create migration', { error: error.message });
  process.exit(1);
}

// Generate Prisma client
try {
  logger.info('Generating Prisma client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  logger.info('Prisma client generated successfully');
} catch (error) {
  logger.error('Failed to generate Prisma client', { error: error.message });
  process.exit(1);
}

logger.info('Authentication migration completed successfully');
