/**
 * Database Indexing Script
 * 
 * This script creates optimized indexes for the Prisma database
 * to improve query performance across the application.
 * 
 * Run this script after migrations to ensure all indexes are properly set up.
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function createDatabaseIndexes() {
  try {
    logger.info('Starting database index creation...');
    
    // Execute raw SQL to create indexes that aren't defined in the Prisma schema
    // These complement the indexes that are already defined in schema.prisma
    
    // Journal indexes for optimized queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "journal_userId_personaId_roomId_idx" 
      ON "Journal" ("userId", "personaId", "roomId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "journal_createdAt_idx" 
      ON "Journal" ("createdAt" DESC);
    `;
    
    // Full text search index for journal content (if PostgreSQL)
    try {
      // This is PostgreSQL specific - will fail on other databases
      await prisma.$executeRaw`
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "journal_prompt_trgm_idx" 
        ON "Journal" USING GIN (prompt gin_trgm_ops);
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "journal_response_trgm_idx" 
        ON "Journal" USING GIN (response gin_trgm_ops);
      `;
      
      logger.info('Created PostgreSQL full-text search indexes');
    } catch (error) {
      logger.info('Skipping PostgreSQL-specific indexes', { error: error.message });
      // This is expected to fail on non-PostgreSQL databases, so we just log and continue
    }
    
    // User indexes for authentication and lookup
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_email_idx" 
      ON "User" ("email");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "user_createdAt_idx" 
      ON "User" ("createdAt" DESC);
    `;
    
    // Conversation indexes for faster retrieval
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "conversation_userId_idx" 
      ON "Conversation" ("userId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "conversation_createdAt_idx" 
      ON "Conversation" ("createdAt" DESC);
    `;
    
    // Message indexes for conversation retrieval
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "message_conversationId_idx" 
      ON "Message" ("conversationId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "message_createdAt_idx" 
      ON "Message" ("createdAt" ASC);
    `;
    
    // Insight indexes for faster retrieval
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "insight_userId_idx" 
      ON "Insight" ("userId");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "insight_createdAt_idx" 
      ON "Insight" ("createdAt" DESC);
    `;
    
    logger.info('Database indexes created successfully');
    
    // Analyze tables to update statistics for query planner
    try {
      await prisma.$executeRaw`ANALYZE;`;
      logger.info('Database statistics updated');
    } catch (error) {
      logger.info('Skipping database statistics update', { error: error.message });
      // This might not be supported on all database systems
    }
    
    return { success: true, message: 'Database indexes created successfully' };
  } catch (error) {
    logger.error('Error creating database indexes', { error: error.message });
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  createDatabaseIndexes()
    .then((result) => {
      console.log(result.message);
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = createDatabaseIndexes;
