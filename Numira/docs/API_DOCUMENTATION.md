# Numira API Documentation

This document provides comprehensive documentation for the Numira API endpoints.

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Personas](#personas)
4. [Rooms](#rooms)
5. [AI Interactions](#ai-interactions)
6. [Journals](#journals)
7. [Disclaimers](#disclaimers)
8. [Metrics](#metrics)
9. [Analytics](#analytics)
10. [Health Checks](#health-checks)
11. [LLM Provider Management](#llm-provider-management)

## Authentication

### POST /api/auth/login

Authenticates a user and returns a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user123",
      "email": "user@example.com"
    }
  },
  "message": "Login successful"
}
```

### POST /api/auth/register

Registers a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user456",
      "email": "newuser@example.com"
    }
  },
  "message": "Registration successful"
}
```

## Users

### GET /api/auth/me

Gets the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  },
  "message": "User retrieved successfully"
}
```

### GET /api/users/me

Gets the authenticated user's profile (legacy endpoint).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  },
  "message": "User profile retrieved successfully"
}
```

## Personas

### GET /api/personas

Gets all available personas.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "ayla",
      "name": "Ayla",
      "tone": "warm, nurturing, gentle",
      "voice": "soft-spoken, soothing, compassionate",
      "description": "Ayla is warm, nurturing, and deeply empathetic...",
      "defaultRooms": ["mirrorRoom", "moodBooth", "clarityBar"],
      "tags": ["empathetic", "nurturing", "gentle", "supportive", "warm"]
    },
    {
      "id": "cam",
      "name": "Cam",
      "tone": "thoughtful, structured, insightful",
      "voice": "clear, articulate, balanced",
      "description": "Cam is insightful, structured, and thoughtful...",
      "defaultRooms": ["mirrorRoom", "reframeRoom", "clarityBar"],
      "tags": ["analytical", "structured", "insightful", "thoughtful", "clear"]
    }
  ],
  "message": "Personas retrieved successfully",
  "metadata": {
    "count": 2
  }
}
```

### GET /api/personas/:id

Gets a specific persona by ID.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "ayla",
    "name": "Ayla",
    "tone": "warm, nurturing, gentle",
    "voice": "soft-spoken, soothing, compassionate",
    "description": "Ayla is warm, nurturing, and deeply empathetic...",
    "defaultRooms": ["mirrorRoom", "moodBooth", "clarityBar"],
    "tags": ["empathetic", "nurturing", "gentle", "supportive", "warm"]
  },
  "message": "Persona retrieved successfully"
}
```

### GET /api/personas/:id/compatible-rooms

Gets all rooms compatible with a specific persona.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "mirrorRoom",
      "name": "Mirror Room",
      "description": "A space for self-reflection and emotional exploration...",
      "purpose": "To help users gain insight into their emotions...",
      "promptType": "open",
      "tags": ["reflection", "emotional-awareness", "self-discovery", "insight"]
    },
    {
      "id": "clarityBar",
      "name": "Clarity Bar",
      "description": "A space for decision-making support and problem-solving...",
      "purpose": "To help users gain clarity on complex situations...",
      "promptType": "guided",
      "tags": ["decision-making", "problem-solving", "clarity", "options-exploration"]
    }
  ],
  "message": "Compatible rooms for persona ayla retrieved successfully",
  "metadata": {
    "count": 2,
    "personaId": "ayla"
  }
}
```

## Rooms

### GET /api/rooms

Gets all available rooms.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "mirrorRoom",
      "name": "Mirror Room",
      "description": "A space for self-reflection and emotional exploration...",
      "purpose": "To help users gain insight into their emotions...",
      "supportedPersonas": ["ayla", "cam", "rumi"],
      "promptType": "open",
      "tags": ["reflection", "emotional-awareness", "self-discovery", "insight"]
    },
    {
      "id": "reframeRoom",
      "name": "Reframe Room",
      "description": "A space for shifting perspectives and challenging limiting beliefs...",
      "purpose": "To help users break free from limiting perspectives...",
      "supportedPersonas": ["cam", "jax", "rumi"],
      "promptType": "targeted",
      "tags": ["perspective-shift", "cognitive-reframing", "belief-work", "transformation"]
    }
  ],
  "message": "Rooms retrieved successfully",
  "metadata": {
    "count": 2
  }
}
```

### GET /api/rooms/:id

Gets a specific room by ID.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "mirrorRoom",
    "name": "Mirror Room",
    "description": "A space for self-reflection and emotional exploration...",
    "purpose": "To help users gain insight into their emotions...",
    "supportedPersonas": ["ayla", "cam", "rumi"],
    "promptType": "open",
    "tags": ["reflection", "emotional-awareness", "self-discovery", "insight"]
  },
  "message": "Room retrieved successfully"
}
```

### GET /api/rooms/:id/compatible-personas

Gets all personas compatible with a specific room.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "ayla",
      "name": "Ayla",
      "tone": "warm, nurturing, gentle",
      "voice": "soft-spoken, soothing, compassionate",
      "description": "Ayla is warm, nurturing, and deeply empathetic..."
    },
    {
      "id": "cam",
      "name": "Cam",
      "tone": "thoughtful, structured, insightful",
      "voice": "clear, articulate, balanced",
      "description": "Cam is insightful, structured, and thoughtful..."
    }
  ],
  "message": "Compatible personas for room mirrorRoom retrieved successfully",
  "metadata": {
    "count": 2,
    "roomId": "mirrorRoom"
  }
}
```

## AI Interactions

### POST /api/ai/chat

Generates an AI response based on user input, persona, and room.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "userInput": "I've been feeling overwhelmed lately",
  "personaId": "ayla",
  "roomId": "mirrorRoom",
  "saveToJournal": true
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "response": "It sounds like you're going through a challenging time with these feelings of being overwhelmed. That's completely understandable and a very human experience. Would you like to explore what might be contributing to these feelings? Sometimes just naming the different factors can help us feel more grounded and give us a clearer perspective on what we're experiencing."
  },
  "message": "AI response generated successfully",
  "metadata": {
    "personaId": "ayla",
    "roomId": "mirrorRoom",
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

### GET /api/ai/compatibility/:personaId/:roomId

Checks if a persona is compatible with a room.

**Response:**
```json
{
  "status": "success",
  "data": {
    "personaId": "ayla",
    "roomId": "mirrorRoom",
    "isCompatible": true,
    "personaName": "Ayla",
    "roomName": "Mirror Room"
  },
  "message": "Ayla is compatible with Mirror Room"
}
```

## Journals

### POST /api/journals

Creates a new journal entry.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "personaId": "ayla",
  "roomId": "mirrorRoom",
  "prompt": "I've been feeling overwhelmed lately",
  "response": "It sounds like you're going through a challenging time with these feelings of being overwhelmed. That's completely understandable and a very human experience. Would you like to explore what might be contributing to these feelings? Sometimes just naming the different factors can help us feel more grounded and give us a clearer perspective on what we're experiencing."
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "journal": {
      "id": "journal123",
      "userId": "user123",
      "personaId": "ayla",
      "roomId": "mirrorRoom",
      "prompt": "I've been feeling overwhelmed lately",
      "response": "It sounds like you're going through a challenging time...",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  },
  "message": "Journal entry created successfully",
  "metadata": {
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

### GET /api/journals

Gets all journal entries for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Maximum number of entries to return (default: 20)
- `offset` (optional): Number of entries to skip (default: 0)
- `sortBy` (optional): Field to sort by (default: 'createdAt')
- `sortOrder` (optional): Sort order ('asc' or 'desc', default: 'desc')

**Response:**
```json
{
  "status": "success",
  "data": {
    "journals": [
      {
        "id": "journal123",
        "userId": "user123",
        "personaId": "ayla",
        "roomId": "mirrorRoom",
        "prompt": "I've been feeling overwhelmed lately",
        "response": "It sounds like you're going through a challenging time...",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2023-01-01T00:00:00.000Z"
      },
      {
        "id": "journal456",
        "userId": "user123",
        "personaId": "cam",
        "roomId": "clarityBar",
        "prompt": "How can I manage stress better?",
        "response": "Managing stress effectively involves several approaches...",
        "createdAt": "2023-01-02T00:00:00.000Z",
        "updatedAt": "2023-01-02T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 2,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "message": "Journal entries retrieved successfully",
  "metadata": {
    "timestamp": "2023-01-03T00:00:00.000Z"
  }
}
```

### GET /api/journals/:id

Gets a specific journal entry by ID.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "journal": {
      "id": "journal123",
      "userId": "user123",
      "personaId": "ayla",
      "roomId": "mirrorRoom",
      "prompt": "I've been feeling overwhelmed lately",
      "response": "It sounds like you're going through a challenging time...",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  },
  "message": "Journal entry retrieved successfully",
  "metadata": {
    "timestamp": "2023-01-03T00:00:00.000Z"
  }
}
```

### DELETE /api/journals/:id

Deletes a journal entry.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": null,
  "message": "Journal entry deleted successfully",
  "metadata": {
    "timestamp": "2023-01-03T00:00:00.000Z"
  }
}
```

## Disclaimers

### GET /api/disclaimer

Gets the current disclaimer text and version.

**Response:**
```json
{
  "status": "success",
  "data": {
    "version": "1.0",
    "text": "# IMPORTANT DISCLAIMER\n\n## Non-Clinical Nature of Service\n\nNumira is NOT a medical or mental health service..."
  },
  "message": "Disclaimer retrieved successfully"
}
```

### GET /api/disclaimer/status

Gets the authenticated user's disclaimer acknowledgment status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "user123",
    "accepted": true,
    "acceptedAt": "2023-01-01T00:00:00.000Z",
    "version": "1.0",
    "isExpired": false,
    "isValid": true
  },
  "message": "Disclaimer status retrieved successfully"
}
```

### POST /api/disclaimer/acknowledge

Acknowledges the disclaimer for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "version": "1.0"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "user123",
    "disclaimerAccepted": true,
    "disclaimerAcceptedAt": "2023-01-01T00:00:00.000Z",
    "disclaimerVersion": "1.0"
  },
  "message": "Disclaimer acknowledged successfully"
}
```

## Metrics

### GET /api/metrics

Gets basic system metrics (public, limited info).

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### GET /api/metrics/system

Gets detailed system metrics (admin only).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "system": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v16.14.0",
    "uptime": 86400,
    "processUptime": 3600,
    "totalMemory": 8589934592,
    "freeMemory": 4294967296,
    "usedMemory": {
      "rss": 104857600,
      "heapTotal": 67108864,
      "heapUsed": 33554432,
      "external": 16777216
    },
    "cpuUsage": [0.5, 0.3, 0.2],
    "cpuCount": 4
  },
  "process": {
    "pid": 1234,
    "memoryUsage": {
      "rss": 104857600,
      "heapTotal": 67108864,
      "heapUsed": 33554432,
      "external": 16777216
    }
  }
}
```

### GET /api/metrics/ai

Gets AI usage metrics (admin only).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalRequests": 1000,
  "models": [
    {
      "model": "gpt-4",
      "status": "success",
      "requestCount": 750,
      "totalPromptTokens": 150000,
      "totalCompletionTokens": 30000,
      "totalTokens": 180000,
      "avgLatencyMs": 2500,
      "costEstimate": {
        "promptCost": 4.5,
        "completionCost": 1.8,
        "totalCost": 6.3
      }
    },
    {
      "model": "gpt-3.5-turbo",
      "status": "success",
      "requestCount": 250,
      "totalPromptTokens": 50000,
      "totalCompletionTokens": 10000,
      "totalTokens": 60000,
      "avgLatencyMs": 500,
      "costEstimate": {
        "promptCost": 0.075,
        "completionCost": 0.02,
        "totalCost": 0.095
      }
    }
  ],
  "totalCost": 6.395,
  "personaUsage": [
    {
      "personaId": "ayla",
      "count": 400
    },
    {
      "personaId": "cam",
      "count": 350
    }
  ],
  "roomUsage": [
    {
      "roomId": "mirrorRoom",
      "count": 500
    },
    {
      "roomId": "clarityBar",
      "count": 250
    }
  ],
  "phiDetection": {
    "total": 15,
    "byDay": [
      {
        "day": "2023-01-01",
        "count": 5
      },
      {
        "day": "2023-01-02",
        "count": 10
      }
    ],
    "byPersona": [
      {
        "personaId": "ayla",
        "count": 8
      },
      {
        "personaId": "cam",
        "count": 7
      }
    ],
    "byRoom": [
      {
        "roomId": "mirrorRoom",
        "count": 10
      },
      {
        "roomId": "clarityBar",
        "count": 5
      }
    ]
  }
}
```

## Analytics

### GET /api/analytics/personas

Gets persona usage statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "personaId": "ayla",
      "name": "Ayla",
      "count": 450
    },
    {
      "personaId": "cam",
      "name": "Cam",
      "count": 320
    },
    {
      "personaId": "rumi",
      "name": "Rumi",
      "count": 280
    }
  ],
  "message": "Persona usage statistics retrieved successfully"
}
```

### GET /api/analytics/rooms

Gets room usage statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "roomId": "mirrorRoom",
      "name": "Mirror Room",
      "count": 520
    },
    {
      "roomId": "clarityBar",
      "name": "Clarity Bar",
      "count": 310
    },
    {
      "roomId": "reframeRoom",
      "name": "Reframe Room",
      "count": 220
    }
  ],
  "message": "Room usage statistics retrieved successfully"
}
```

### GET /api/analytics/combinations

Gets persona-room combination usage statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "personaId": "ayla",
      "personaName": "Ayla",
      "roomId": "mirrorRoom",
      "roomName": "Mirror Room",
      "count": 250
    },
    {
      "personaId": "cam",
      "personaName": "Cam",
      "roomId": "clarityBar",
      "roomName": "Clarity Bar",
      "count": 180
    },
    {
      "personaId": "rumi",
      "personaName": "Rumi",
      "roomId": "reframeRoom",
      "roomName": "Reframe Room",
      "count": 150
    }
  ],
  "message": "Persona-room combination statistics retrieved successfully"
}
```

### GET /api/analytics/ai

Gets AI usage statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalRequests": 1050,
    "tokens": {
      "prompt": 210000,
      "completion": 42000,
      "total": 252000
    },
    "averageResponseTime": 1800,
    "cacheHitRate": "15.24%",
    "cacheHits": 160,
    "cacheMisses": 890,
    "models": [
      {
        "name": "gpt-4",
        "count": 800,
        "totalTokens": 200000,
        "cost": 7.2
      },
      {
        "name": "gpt-3.5-turbo",
        "count": 250,
        "totalTokens": 52000,
        "cost": 0.104
      }
    ],
    "estimatedCost": "7.30"
  },
  "message": "AI usage statistics retrieved successfully"
}
```

### GET /api/analytics/users

Gets user engagement statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalUsers": 500,
    "activeUsers": 320,
    "newUsers": 45,
    "totalInteractions": 2800,
    "avgInteractionsPerUser": "8.75",
    "topUsers": [
      {
        "userId": "user123",
        "interactionCount": 78
      },
      {
        "userId": "user456",
        "interactionCount": 65
      }
    ],
    "interactionFrequency": {
      "1": 50,
      "2-5": 120,
      "6-10": 80,
      "11-20": 40,
      "21-50": 25,
      "51+": 5
    }
  },
  "message": "User engagement statistics retrieved successfully"
}
```

### GET /api/analytics/summary

Gets summary of all analytics.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Query Parameters:**
- `startDate` (optional): Start date for the query (ISO format)
- `endDate` (optional): End date for the query (ISO format)

**Response:**
```json
{
  "status": "success",
  "data": {
    "dateRange": {
      "startDate": "2023-01-01T00:00:00.000Z",
      "endDate": "2023-01-31T23:59:59.999Z"
    },
    "users": {
      "total": 500,
      "active": 320,
      "new": 45,
      "avgInteractionsPerUser": "8.75"
    },
    "interactions": {
      "total": 2800,
      "topPersonas": [
        {
          "personaId": "ayla",
          "name": "Ayla",
          "count": 450
        },
        {
          "personaId": "cam",
          "name": "Cam",
          "count": 320
        }
      ],
      "topRooms": [
        {
          "roomId": "mirrorRoom",
          "name": "Mirror Room",
          "count": 520
        },
        {
          "roomId": "clarityBar",
          "name": "Clarity Bar",
          "count": 310
        }
      ],
      "topCombinations": [
        {
          "personaId": "ayla",
          "personaName": "Ayla",
          "roomId": "mirrorRoom",
          "roomName": "Mirror Room",
          "count": 250
        },
        {
          "personaId": "cam",
          "personaName": "Cam",
          "roomId": "clarityBar",
          "roomName": "Clarity Bar",
          "count": 180
        }
      ]
    },
    "ai": {
      "totalRequests": 1050,
      "totalTokens": 252000,
      "estimatedCost": "$7.30",
      "cacheHitRate": "15.24%",
      "avgResponseTime": "1.80s"
    }
  },
  "message": "Analytics summary retrieved successfully"
}
```

### POST /api/analytics/cleanup

Clean up old analytics data.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Request:**
```json
{
  "retentionDays": 180
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "deletedAnalytics": 1250,
    "deletedAIMetrics": 980
  },
  "message": "Successfully cleaned up analytics data older than 180 days"
}
```

## Health Checks

### GET /health

Checks if the API is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### GET /api/health

Checks if the API is running (with prefix).

**Response:**
```json
{
  "status": "success",
  "data": {
    "service": "api",
    "status": "operational"
  },
  "message": "API service is operational"
}
```

### GET /api/ai/health

Checks if the AI service is running.

**Response:**
```json
{
  "status": "success",
  "data": {
    "service": "ai",
    "status": "operational"
  },
  "message": "AI service is operational"
}
```

## LLM Provider Management

### GET /api/llm/status

Gets the status of all LLM providers and their circuit breakers.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Response:**
```json
{
  "status": "success",
  "data": {
    "providers": {
      "openai": {
        "name": "OpenAI",
        "available": true,
        "circuitOpen": false,
        "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        "defaultModel": "gpt-4"
      },
      "anthropic": {
        "name": "Anthropic",
        "available": true,
        "circuitOpen": false,
        "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
        "defaultModel": "claude-3-sonnet"
      }
    },
    "circuitBreakers": {
      "openai": {
        "name": "openai",
        "state": "CLOSED",
        "failureCount": 0,
        "successCount": 0,
        "lastStateChange": "2023-01-01T00:00:00.000Z",
        "lastError": null,
        "openDuration": 0
      },
      "anthropic": {
        "name": "anthropic",
        "state": "CLOSED",
        "failureCount": 0,
        "successCount": 0,
        "lastStateChange": "2023-01-01T00:00:00.000Z",
        "lastError": null,
        "openDuration": 0
      }
    }
  },
  "message": "LLM provider status retrieved successfully"
}
```

### POST /api/llm/reset/:provider

Resets the circuit breaker for a specific LLM provider.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**URL Parameters:**
- `provider`: The provider name (e.g., "openai", "anthropic")

**Response:**
```json
{
  "status": "success",
  "data": null,
  "message": "Circuit breaker for openai reset successfully"
}
```

### POST /api/llm/reset-all

Resets all circuit breakers for all LLM providers.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Response:**
```json
