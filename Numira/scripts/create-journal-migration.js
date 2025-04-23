/**
 * Journal Migration Script
 * 
 * This script creates a migration for adding the Journal model to the database.
 * It generates a Prisma migration that adds the journals table and its relationships.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

async function createMigration() {
  try {
    console.log('Creating migration for Journal model...');

    // Check if the schema already contains the Journal model
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    if (schemaContent.includes('model Journal {')) {
      console.log('Journal model already exists in schema. Skipping migration.');
      return;
    }

    // Create a backup of the current schema
    const backupPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.bak');
    fs.writeFileSync(backupPath, schemaContent);
    console.log('Created backup of current schema at:', backupPath);

    // Add Journal model to schema
    const journalModel = `
model Journal {
  id          String   @id @default(cuid())
  userId      String
  personaId   String
  roomId      String
  prompt      String   @db.Text
  response    String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@map("journals")
}`;

    // Update User model to include journals relation
    const updatedSchema = schemaContent.replace(
      'model User {',
      'model User {',
    ).replace(
      '  // User data',
      '  // User data\n  journals      Journal[]'
    );

    // Add Journal model after User model
    const finalSchema = updatedSchema.replace(
      '@@map("users")\n}',
      '@@map("users")\n}\n' + journalModel
    );

    // Write updated schema
    fs.writeFileSync(schemaPath, finalSchema);
    console.log('Updated schema with Journal model');

    // Create migration using Prisma CLI
    console.log('Creating Prisma migration...');
    execSync('npx prisma migrate dev --name add_journal_model', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    console.log('Migration created successfully!');
    console.log('Next steps:');
    console.log('1. Review the migration in prisma/migrations');
    console.log('2. Apply the migration to your database with: npx prisma migrate deploy');

  } catch (error) {
    console.error('Error creating migration:', error);
    
    // Restore backup if it exists
    const backupPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.bak');
    if (fs.existsSync(backupPath)) {
      const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
      fs.copyFileSync(backupPath, schemaPath);
      console.log('Restored schema from backup');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration creation
createMigration();
