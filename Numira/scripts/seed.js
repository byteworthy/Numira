/**
 * Database Seeding Script
 * 
 * This script seeds the database with personas and rooms from the config files.
 * It uses Prisma to upsert records, avoiding duplicate inserts.
 * 
 * Usage: node scripts/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const personas = require('../config/personas');
const rooms = require('../config/rooms');

const prisma = new PrismaClient();

/**
 * Main seeding function
 */
async function main() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Seed personas
    await seedPersonas();
    
    // Seed rooms
    await seedRooms();
    
    // Seed test user
    await seedTestUser();
    
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seed personas from config
 */
async function seedPersonas() {
  console.log(`\n📊 Seeding ${personas.length} personas...`);
  
  const results = await Promise.all(
    personas.map(async (persona) => {
      try {
        // Upsert persona (create if not exists, update if exists)
        const result = await prisma.persona.upsert({
          where: { id: persona.id },
          update: {
            name: persona.name,
            tone: persona.tone,
            voice: persona.voice,
            description: persona.description,
            systemPrompt: persona.systemPrompt,
            defaultRooms: persona.defaultRooms,
            tags: persona.tags
          },
          create: {
            id: persona.id,
            name: persona.name,
            tone: persona.tone,
            voice: persona.voice,
            description: persona.description,
            systemPrompt: persona.systemPrompt,
            defaultRooms: persona.defaultRooms,
            tags: persona.tags
          }
        });
        
        console.log(`  ✓ Persona "${persona.name}" (${persona.id}) upserted successfully`);
        return { success: true, id: persona.id };
      } catch (error) {
        console.error(`  ✗ Failed to upsert persona "${persona.name}" (${persona.id}):`, error);
        return { success: false, id: persona.id, error };
      }
    })
  );
  
  const successful = results.filter(r => r.success).length;
  console.log(`📊 Personas seeding completed: ${successful}/${personas.length} successful`);
}

/**
 * Seed rooms from config
 */
async function seedRooms() {
  console.log(`\n🏠 Seeding ${rooms.length} rooms...`);
  
  const results = await Promise.all(
    rooms.map(async (room) => {
      try {
        // Upsert room (create if not exists, update if exists)
        const result = await prisma.room.upsert({
          where: { id: room.id },
          update: {
            name: room.name,
            description: room.description,
            purpose: room.purpose,
            supportedPersonas: room.supportedPersonas,
            samplePrompt: room.samplePrompt,
            tags: room.tags,
            promptType: room.promptType,
            features: room.features
          },
          create: {
            id: room.id,
            name: room.name,
            description: room.description,
            purpose: room.purpose,
            supportedPersonas: room.supportedPersonas,
            samplePrompt: room.samplePrompt,
            tags: room.tags,
            promptType: room.promptType,
            features: room.features
          }
        });
        
        console.log(`  ✓ Room "${room.name}" (${room.id}) upserted successfully`);
        return { success: true, id: room.id };
      } catch (error) {
        console.error(`  ✗ Failed to upsert room "${room.name}" (${room.id}):`, error);
        return { success: false, id: room.id, error };
      }
    })
  );
  
  const successful = results.filter(r => r.success).length;
  console.log(`🏠 Rooms seeding completed: ${successful}/${rooms.length} successful`);
}

/**
 * Seed a test user for development and testing
 */
async function seedTestUser() {
  console.log('\n👤 Seeding test user...');
  
  try {
    // Create a test user with a known ID for easier testing
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {
        // Only update disclaimer acceptance to avoid overwriting other fields
        disclaimerAccepted: true,
        disclaimerAcceptedAt: new Date(),
        disclaimerVersion: '1.0'
      },
      create: {
        email: 'test@example.com',
        passwordHash: '$2b$10$dGLaD.iyVX5W8/5mLCHvAOy0VO4rSMKPgxl7gBgzVGKLBJRn8nLYe', // 'password123'
        salt: 'test-salt',
        disclaimerAccepted: true,
        disclaimerAcceptedAt: new Date(),
        disclaimerVersion: '1.0'
      }
    });
    
    console.log(`  ✓ Test user created/updated with ID: ${testUser.id}`);
    
    // Create a sample journal entry for the test user
    const sampleJournal = await prisma.journal.upsert({
      where: {
        id: 'test-journal-entry'
      },
      update: {
        prompt: 'How can I manage stress better?',
        response: 'Managing stress effectively involves several approaches. First, try to identify your stress triggers. Then, develop healthy coping mechanisms like deep breathing, meditation, or physical exercise. Ensure you\'re getting enough sleep and maintaining a balanced diet. It\'s also important to set boundaries and make time for activities you enjoy. Remember that seeking support from friends, family, or professionals is a sign of strength, not weakness.',
        userId: testUser.id,
        personaId: 'ayla',
        roomId: 'clarityBar'
      },
      create: {
        id: 'test-journal-entry',
        prompt: 'How can I manage stress better?',
        response: 'Managing stress effectively involves several approaches. First, try to identify your stress triggers. Then, develop healthy coping mechanisms like deep breathing, meditation, or physical exercise. Ensure you\'re getting enough sleep and maintaining a balanced diet. It\'s also important to set boundaries and make time for activities you enjoy. Remember that seeking support from friends, family, or professionals is a sign of strength, not weakness.',
        userId: testUser.id,
        personaId: 'ayla',
        roomId: 'clarityBar'
      }
    });
    
    console.log(`  ✓ Sample journal entry created/updated with ID: ${sampleJournal.id}`);
    
    return { success: true, userId: testUser.id };
  } catch (error) {
    console.error('  ✗ Failed to seed test user:', error);
    return { success: false, error };
  }
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error during seeding:', error);
    process.exit(1);
  });
