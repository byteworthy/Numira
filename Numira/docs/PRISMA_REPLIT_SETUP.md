# Prisma Setup for Replit Environment

This document explains how to set up Prisma to work correctly in the Replit environment, addressing common issues with system dependencies.

## Problem

When running Prisma in the Replit environment, you might encounter the following error:

```
Unable to require(`/home/runner/workspace/Numira/node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node`).
Prisma cannot find the required `libssl` system library in your system. Please install openssl-1.1.x and try again.

Details: libssl.so.1.1: cannot open shared object file: No such file or directory
```

This occurs because Prisma's query engine requires OpenSSL 1.1.x, which is not installed by default in the Replit environment. Additionally, Replit doesn't allow direct installation of system packages through shell commands:

```
Tools like apt, brew, and yum which modify system dependencies are not
directly callable inside Replit. We offer the System Dependencies
pane for easy dependency management.
```

## Solution

We've implemented a different approach to solve this issue by using SQLite instead of PostgreSQL for the Replit environment:

### 1. Use SQLite as the database provider

The `prisma/schema.prisma` file has been updated to use SQLite instead of PostgreSQL:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x"]
  engineType    = "binary"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

SQLite is a file-based database that doesn't require additional system dependencies, making it ideal for environments like Replit where installing system packages is restricted.

### 2. Update database configuration

The `config/config.js` file has been updated to use SQLite:

```javascript
// Database configuration
database: {
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  type: 'sqlite',
  // SQLite doesn't use these PostgreSQL-specific options
  ssl: false,
  maxConnections: 1, // SQLite supports only one connection
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10)
},
```

### 3. Ensure proper directory structure

The `setup.sh` script has been modified to ensure the prisma directory exists with proper permissions:

```bash
# Ensure prisma directory exists with proper permissions
echo "🗂️ Ensuring prisma directory exists..."
mkdir -p prisma
chmod -R 755 prisma
```

### 4. Update database setup script

The `scripts/setup-database.js` script has been updated to handle SQLite database creation:

```javascript
// Create SQLite database file if it doesn't exist
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
```

## Benefits of this Approach

1. **No system dependencies**: SQLite doesn't require additional system libraries like OpenSSL
2. **Simplified setup**: File-based database is easier to set up in restricted environments
3. **Portability**: SQLite database file can be easily backed up and restored
4. **Performance**: For development and testing purposes, SQLite provides adequate performance

## Limitations

1. **Not suitable for production**: This SQLite setup is intended for development and testing in Replit only
2. **Limited concurrency**: SQLite has limited support for concurrent connections
3. **Feature differences**: Some PostgreSQL-specific features may not be available in SQLite

## References

- [Prisma Documentation on SQLite](https://www.prisma.io/docs/concepts/database-connectors/sqlite)
- [Prisma Documentation on Binary Targets](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets)
- [Replit Documentation on System Dependencies](https://docs.replit.com/replit-workspace/dependency-management)
