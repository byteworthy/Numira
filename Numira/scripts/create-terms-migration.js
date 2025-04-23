/**
 * Create Terms of Service Migration
 * 
 * This script creates a Prisma migration for the terms of service feature.
 * It adds the necessary tables for storing terms of service and user acceptance.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

// Migration name
const MIGRATION_NAME = 'add_terms_of_service';

// Prisma schema additions
const SCHEMA_ADDITIONS = `
// Terms of Service model
model TermsOfService {
  id           String   @id @default(uuid())
  version      String   @unique
  content      String   @db.Text
  effectiveDate DateTime
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  userAcceptances UserTermsAcceptance[]

  @@map("terms_of_service")
}

// User Terms Acceptance model
model UserTermsAcceptance {
  id              String   @id @default(uuid())
  userId          String
  termsOfServiceId String
  acceptedAt      DateTime @default(now())
  acceptedFrom    String   @default("app") // e.g., "app", "web", "ios", "android"
  ipAddress       String?
  
  // Relations
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  termsOfService TermsOfService @relation(fields: [termsOfServiceId], references: [id], onDelete: Cascade)

  @@unique([userId, termsOfServiceId])
  @@map("user_terms_acceptance")
}
`;

// User model relation addition
const USER_MODEL_RELATION = `
  // Terms of service relations
  termsAcceptances UserTermsAcceptance[]
`;

/**
 * Add terms of service models to Prisma schema
 */
function updatePrismaSchema() {
  try {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Check if terms of service models already exist
    if (schema.includes('model TermsOfService')) {
      logger.info('Terms of service models already exist in schema');
      return;
    }
    
    // Add terms of service models
    schema += SCHEMA_ADDITIONS;
    
    // Add relation to User model if it exists
    if (schema.includes('model User {')) {
      schema = schema.replace(
        /model User {([\s\S]*?)}(\s*@@map\("users"\))?/,
        `model User {$1\n${USER_MODEL_RELATION}}$2`
      );
    }
    
    // Write updated schema
    fs.writeFileSync(schemaPath, schema);
    logger.info('Updated Prisma schema with terms of service models');
  } catch (error) {
    logger.error('Error updating Prisma schema', { error: error.message });
    throw error;
  }
}

/**
 * Create Prisma migration
 */
function createMigration() {
  try {
    // Update schema first
    updatePrismaSchema();
    
    // Create migration
    logger.info('Creating Prisma migration...');
    execSync(`npx prisma migrate dev --name ${MIGRATION_NAME}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    logger.info('Migration created successfully');
  } catch (error) {
    logger.error('Error creating migration', { error: error.message });
    throw error;
  }
}

/**
 * Main function
 */
function main() {
  try {
    createMigration();
  } catch (error) {
    logger.error('Migration creation failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  updatePrismaSchema,
  createMigration
};
