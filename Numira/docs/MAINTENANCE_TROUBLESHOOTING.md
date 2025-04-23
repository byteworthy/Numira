# Numira Maintenance and Troubleshooting Guide

This document provides guidance for maintaining and troubleshooting the Numira application. It covers common issues, maintenance procedures, and best practices for ensuring the system runs smoothly.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Monitoring](#monitoring)
3. [Logging](#logging)
4. [Database Maintenance](#database-maintenance)
5. [LLM Provider Management](#llm-provider-management)
6. [Circuit Breaker System](#circuit-breaker-system)
7. [Caching System](#caching-system)
8. [Common Issues and Solutions](#common-issues-and-solutions)
9. [Emergency Procedures](#emergency-procedures)

## System Requirements

- Node.js v16 or higher
- PostgreSQL 13 or higher
- Redis 6 or higher
- 2GB RAM minimum (4GB recommended)
- 10GB disk space minimum

## Monitoring

Numira includes built-in monitoring capabilities:

- Health check endpoint: `/api/health`
- Metrics endpoint: `/api/metrics` (admin access required)
- System status: `/api/system` (admin access required)

For production deployments, consider setting up:

- Uptime monitoring (e.g., Pingdom, UptimeRobot)
- Performance monitoring (e.g., New Relic, Datadog)
- Error tracking (e.g., Sentry)

## Logging

Logs are stored in the `logs/` directory by default. The logging level can be configured in the `.env` file:

```
LOG_LEVEL=info  # error, warn, info, http, verbose, debug, silly
LOG_FORMAT=json  # json or simple
LOG_DIRECTORY=./logs
LOG_MAX_SIZE=5242880  # 5MB
LOG_MAX_FILES=5
```

For production environments, consider forwarding logs to a centralized logging system like ELK Stack or Graylog.

## Database Maintenance

### Backups

Automated backups are configured via cron jobs. The backup script is located at `cron/backup.js`.

To manually trigger a backup:

```bash
node cron/backup.js
```

### Migrations

Database migrations are managed using Prisma. To create a new migration:

```bash
npm run create:migration -- --name your_migration_name
```

To apply pending migrations:

```bash
npx prisma migrate deploy
```

## LLM Provider Management

Numira supports multiple LLM providers with automatic failover capabilities. The system is designed to switch between providers if one becomes unavailable.

### Available Endpoints

- **GET /api/llm/status** - Get status of all LLM providers and their circuit breakers (admin only)
- **POST /api/llm/reset/:provider** - Reset circuit breaker for a specific provider (admin only)
- **POST /api/llm/reset-all** - Reset all circuit breakers (admin only)
- **GET /api/llm/metrics** - Get LLM usage metrics (admin only)

### Configuration

LLM providers are configured in the `.env` file:

```
# AI Service Configuration
AI_PROVIDER=openai  # openai or anthropic

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1000
OPENAI_TIMEOUT=30000

# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-2
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=1000
ANTHROPIC_TIMEOUT=30000
```

### Adding a New Provider

To add a new LLM provider:

1. Update the `llmProviderService.js` file to include the new provider
2. Add the necessary configuration to the `.env` file and `config.js`
3. Update the failover logic in `aiService.js` to include the new provider
4. Add tests for the new provider in the `tests/` directory

## Circuit Breaker System

Numira uses the circuit breaker pattern to prevent cascading failures when external services (like LLM providers) are experiencing issues.

### How It Works

The circuit breaker has three states:

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Service is failing, requests are immediately rejected
3. **HALF-OPEN**: Testing if service has recovered, allows limited requests

When a service fails repeatedly, the circuit opens and prevents further requests for a specified time period. After this timeout, the circuit transitions to half-open state and allows a limited number of test requests. If these succeed, the circuit closes again; if they fail, it reopens.

### Configuration

Circuit breaker settings can be configured in the `.env` file:

```
# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD=2
```

- **FAILURE_THRESHOLD**: Number of failures before opening the circuit
- **RESET_TIMEOUT**: Time in milliseconds before attempting to half-open the circuit
- **HALF_OPEN_SUCCESS_THRESHOLD**: Number of successful requests needed in half-open state to close the circuit

### Managing Circuit Breakers

You can view and manage circuit breakers through the admin API:

```bash
# Get status of all circuit breakers
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/api/llm/status

# Reset a specific circuit breaker
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/api/llm/reset/openai

# Reset all circuit breakers
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:3000/api/llm/reset-all
```

## Caching System

Numira uses Redis for caching to improve performance and reduce load on external services.

### Configuration

Cache settings can be configured in the `.env` file:

```
# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=3600
CACHE_AI_RESPONSE_TTL=86400
CACHE_PERSONA_TTL=3600
CACHE_ROOM_TTL=3600
```

### Cache Keys

Common cache key patterns:

- `persona:{id}` - Persona data
- `room:{id}` - Room data
- `ai:response:{hash}` - AI responses (hashed from input parameters)

### Clearing Cache

To clear specific cache entries:

```javascript
const cacheService = require('./services/cacheService');
await cacheService.del('persona:ayla');
```

To clear all cache:

```javascript
const cacheService = require('./services/cacheService');
await cacheService.flushAll();
```

## Common Issues and Solutions

### API Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| 401 | Unauthorized | Check authentication token |
| 403 | Forbidden | Verify user permissions |
| 429 | Too Many Requests | Implement backoff strategy or increase rate limits |
| 500 | Internal Server Error | Check server logs for details |

### LLM Provider Issues

| Issue | Solution |
|-------|----------|
| OpenAI API errors | Check API key, reset circuit breaker, verify quota |
| Anthropic API errors | Check API key, reset circuit breaker, verify quota |
| Slow responses | Check network connectivity, provider status, adjust timeouts |
| Circuit breaker open | Wait for auto-reset or manually reset if necessary |

### Database Issues

| Issue | Solution |
|-------|----------|
| Connection errors | Check database credentials and connectivity |
| Slow queries | Review and optimize query performance |
| Migration failures | Check migration logs, resolve conflicts manually if needed |

## Emergency Procedures

### Service Outage

1. Check system logs for errors
2. Verify database and Redis connectivity
3. Check LLM provider status
4. Reset circuit breakers if necessary
5. Restart the application if needed

### Data Recovery

1. Stop the application
2. Restore from the latest backup
3. Apply any pending migrations
4. Restart the application
5. Verify system functionality

### Security Incident

1. Isolate affected systems
2. Revoke compromised credentials
3. Apply security patches
4. Restore from clean backups if necessary
5. Document the incident and response

## Support

For additional support, contact the development team at:

- Email: support@numira.app
- Internal Slack: #numira-support
