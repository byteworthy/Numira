const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Create a migration file for adding the Feedback model
 */
async function createMigration() {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
  const migrationName = `${timestamp}_add_feedback_model`;
  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  const migrationDir = path.join(migrationsDir, migrationName);

  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Create migration directory
  fs.mkdirSync(migrationDir);

  // Create migration.sql file
  const migrationSql = `-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");
`;

  fs.writeFileSync(path.join(migrationDir, 'migration.sql'), migrationSql);

  // Create migration metadata file
  const migrationMeta = {
    version: '0.3.0',
    description: 'Add Feedback model',
    sql: [
      {
        dialect: 'sqlite',
        path: './migration.sql',
      },
    ],
  };

  fs.writeFileSync(
    path.join(migrationDir, 'migration.toml'),
    `# This is an auto-generated migration file\n` +
    `# Please do not edit manually\n\n` +
    `version = "${migrationMeta.version}"\n` +
    `description = "${migrationMeta.description}"\n\n` +
    `[sql]\n` +
    `schema = ""\n` +
    `dialect = "${migrationMeta.sql[0].dialect}"\n` +
    `path = "${migrationMeta.sql[0].path}"\n`
  );

  logger.info(`Created migration: ${migrationName}`);
  logger.info(`To apply this migration, run: npx prisma migrate deploy`);
}

createMigration()
  .catch((e) => {
    logger.error(`Error creating migration: ${e.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
