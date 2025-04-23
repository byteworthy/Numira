/**
 * Analytics Migration Script
 * 
 * This script creates a migration to add analytics tables to the database.
 * It adds tables for tracking user interactions with personas and rooms,
 * as well as AI response metrics.
 * 
 * Usage: node scripts/create-analytics-migration.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

// Migration name
const MIGRATION_NAME = 'add-analytics-tables';

// Function to create migration file
async function createMigration() {
  try {
    console.log('Creating analytics migration...');
    
    // Create migration using Prisma
    const command = `npx prisma migrate dev --name ${MIGRATION_NAME} --create-only`;
    execSync(command, { stdio: 'inherit' });
    
    // Find the created migration file
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const migrations = fs.readdirSync(migrationsDir);
    
    // Sort migrations by timestamp (newest first)
    const sortedMigrations = migrations.sort().reverse();
    
    // Find the migration we just created
    const migrationDir = sortedMigrations.find(dir => dir.includes(MIGRATION_NAME));
    
    if (!migrationDir) {
      throw new Error('Could not find the created migration directory');
    }
    
    const migrationPath = path.join(migrationsDir, migrationDir, 'migration.sql');
    
    // Read the existing migration file
    let migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Add our analytics tables SQL
    const analyticsSql = `
-- Analytics tables for tracking user interactions and AI metrics

-- Table for tracking user interactions with personas and rooms
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- Table for tracking AI response metrics
CREATE TABLE "AIMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIMetrics_pkey" PRIMARY KEY ("id")
);

-- Add indexes for faster queries
CREATE INDEX "Analytics_userId_idx" ON "Analytics"("userId");
CREATE INDEX "Analytics_personaId_idx" ON "Analytics"("personaId");
CREATE INDEX "Analytics_roomId_idx" ON "Analytics"("roomId");
CREATE INDEX "Analytics_createdAt_idx" ON "Analytics"("createdAt");
CREATE INDEX "Analytics_interactionType_idx" ON "Analytics"("interactionType");

CREATE INDEX "AIMetrics_userId_idx" ON "AIMetrics"("userId");
CREATE INDEX "AIMetrics_personaId_idx" ON "AIMetrics"("personaId");
CREATE INDEX "AIMetrics_roomId_idx" ON "AIMetrics"("roomId");
CREATE INDEX "AIMetrics_model_idx" ON "AIMetrics"("model");
CREATE INDEX "AIMetrics_createdAt_idx" ON "AIMetrics"("createdAt");
CREATE INDEX "AIMetrics_cached_idx" ON "AIMetrics"("cached");

-- Add foreign key constraints
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMetrics" ADD CONSTRAINT "AIMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;
    
    // Append our SQL to the migration
    migrationSql += analyticsSql;
    
    // Write the updated migration file
    fs.writeFileSync(migrationPath, migrationSql);
    
    console.log(`Analytics migration created successfully at ${migrationPath}`);
    console.log('To apply this migration, run: npx prisma migrate dev');
    
    // Update the Prisma schema to include the new models
    updatePrismaSchema();
    
    return {
      success: true,
      migrationPath
    };
  } catch (error) {
    console.error('Error creating analytics migration:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to update the Prisma schema
function updatePrismaSchema() {
  try {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Check if the models already exist
    if (schema.includes('model Analytics') || schema.includes('model AIMetrics')) {
      console.log('Analytics models already exist in schema.prisma');
      return;
    }
    
    // Add our models to the schema
    const analyticsModels = `
// Analytics models
model Analytics {
  id             String   @id @default(uuid())
  userId         String
  personaId      String
  roomId         String
  interactionType String
  metadata       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([personaId])
  @@index([roomId])
  @@index([createdAt])
  @@index([interactionType])
}

model AIMetrics {
  id              String   @id @default(uuid())
  userId          String
  personaId       String
  roomId          String
  responseTime    Int
  promptTokens    Int
  completionTokens Int
  totalTokens     Int
  model           String
  cached          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([personaId])
  @@index([roomId])
  @@index([model])
  @@index([createdAt])
  @@index([cached])
}
`;
    
    // Append our models to the schema
    schema += analyticsModels;
    
    // Write the updated schema file
    fs.writeFileSync(schemaPath, schema);
    
    console.log('Prisma schema updated successfully');
    
    // Update the User model to include the relation
    updateUserModel();
    
  } catch (error) {
    console.error('Error updating Prisma schema:', error.message);
  }
}

// Function to update the User model
function updateUserModel() {
  try {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Find the User model
    const userModelRegex = /model User {[\s\S]*?}/;
    const userModel = schema.match(userModelRegex);
    
    if (!userModel) {
      console.log('Could not find User model in schema.prisma');
      return;
    }
    
    // Check if the relations already exist
    if (userModel[0].includes('analytics ') || userModel[0].includes('aiMetrics ')) {
      console.log('Analytics relations already exist in User model');
      return;
    }
    
    // Add our relations to the User model
    const updatedUserModel = userModel[0].replace(
      '}',
      '  analytics       Analytics[]  @relation("UserAnalytics")\n  aiMetrics       AIMetrics[]   @relation("UserAIMetrics")\n}'
    );
    
    // Replace the User model in the schema
    schema = schema.replace(userModelRegex, updatedUserModel);
    
    // Write the updated schema file
    fs.writeFileSync(schemaPath, schema);
    
    console.log('User model updated successfully');
    
  } catch (error) {
    console.error('Error updating User model:', error.message);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  createMigration()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = {
  createMigration
};
