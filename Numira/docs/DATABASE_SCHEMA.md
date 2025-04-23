# Numira Database Schema

This document outlines the database schema for the Numira application, detailing the structure of each model and the relationships between them.

## Overview

Numira uses PostgreSQL as its primary database, with Prisma as the ORM (Object-Relational Mapping) layer. The schema is defined in the `prisma/schema.prisma` file.

## Models

### User

The User model represents registered users of the application.

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  // Authentication fields
  passwordHash        String?
  salt                String?
  
  // Disclaimer acceptance
  disclaimerAccepted  Boolean   @default(false)
  disclaimerAcceptedAt DateTime?
  disclaimerVersion   String?
  
  // User data
  journals            Journal[]
  
  @@map("users")
}
```

#### Fields

- `id`: Unique identifier for the user (CUID format)
- `email`: User's email address (unique)
- `createdAt`: Timestamp when the user was created
- `updatedAt`: Timestamp when the user was last updated
- `passwordHash`: Hashed password for authentication
- `salt`: Salt used for password hashing
- `disclaimerAccepted`: Whether the user has accepted the disclaimer
- `disclaimerAcceptedAt`: Timestamp when the user accepted the disclaimer
- `disclaimerVersion`: Version of the disclaimer that was accepted
- `journals`: Relationship to the user's journal entries

### Journal

The Journal model represents conversation entries saved by users.

```prisma
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
}
```

#### Fields

- `id`: Unique identifier for the journal entry (CUID format)
- `userId`: Reference to the user who owns this journal entry
- `personaId`: ID of the persona used in the conversation
- `roomId`: ID of the room where the conversation took place
- `prompt`: The user's input/prompt
- `response`: The AI's response
- `createdAt`: Timestamp when the journal entry was created
- `updatedAt`: Timestamp when the journal entry was last updated
- `user`: Relationship to the user who owns this journal entry

### Persona

The Persona model represents AI personalities that users can interact with.

```prisma
model Persona {
  id           String   @id
  name         String
  tone         String
  voice        String
  description  String   @db.Text
  systemPrompt String   @db.Text
  defaultRooms String[] // Array of room IDs
  tags         String[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("personas")
}
```

#### Fields

- `id`: Unique identifier for the persona
- `name`: Display name of the persona
- `tone`: Description of the persona's tone
- `voice`: Description of the persona's voice
- `description`: Detailed description of the persona
- `systemPrompt`: System prompt used for the AI model
- `defaultRooms`: Array of room IDs that this persona is compatible with by default
- `tags`: Array of tags describing the persona
- `createdAt`: Timestamp when the persona was created
- `updatedAt`: Timestamp when the persona was last updated

### Room

The Room model represents virtual spaces where conversations take place.

```prisma
model Room {
  id                String     @id
  name              String
  description       String     @db.Text
  purpose           String     @db.Text
  supportedPersonas String[]   // Array of persona IDs
  samplePrompt      String
  tags              String[]
  promptType        PromptType
  features          Json       // JSON object for features
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@map("rooms")
}

enum PromptType {
  open
  guided
  short_form @map("short-form")
  targeted
}
```

#### Fields

- `id`: Unique identifier for the room
- `name`: Display name of the room
- `description`: Detailed description of the room
- `purpose`: The purpose or goal of the room
- `supportedPersonas`: Array of persona IDs that are compatible with this room
- `samplePrompt`: Example prompt for this room
- `tags`: Array of tags describing the room
- `promptType`: Type of prompt (open, guided, short-form, targeted)
- `features`: JSON object containing room features
- `createdAt`: Timestamp when the room was created
- `updatedAt`: Timestamp when the room was last updated

## Relationships

- **User to Journal**: One-to-many relationship. A user can have multiple journal entries.
- **Persona to Room**: Many-to-many relationship (implemented through arrays). A persona can be compatible with multiple rooms, and a room can support multiple personas.

## Indexes

- `userId` on the Journal model: Improves query performance when retrieving journal entries for a specific user.

## Notes

- The schema uses CUID (Collision-resistant Unique Identifiers) for primary keys in the User and Journal models.
- The Persona and Room models use custom string IDs for better readability and reference.
- Text fields that may contain large amounts of data use the `@db.Text` type.
- Arrays are used to implement many-to-many relationships between Personas and Rooms.
- JSON fields are used for flexible data structures like room features.
