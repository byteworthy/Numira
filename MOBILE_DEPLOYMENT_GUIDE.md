# Mobile Deployment Guide

This guide provides instructions for deploying the Numira backend API to support mobile applications (iOS and Android).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Deployment Options](#deployment-options)
4. [API Configuration for Mobile](#api-configuration-for-mobile)
5. [Security Considerations](#security-considerations)
6. [Monitoring and Scaling](#monitoring-and-scaling)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 16.x or higher
- PostgreSQL 14.x or higher
- Git
- Docker (optional, for containerized deployment)
- A Render.com, Heroku, or similar cloud platform account

## Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/numira.git
   cd numira
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.sample`:
   ```bash
   cp .env.sample .env
   ```

4. Update the `.env` file with your configuration values, especially:
   - Database connection details
   - JWT secret
   - OpenAI API key
   - CORS settings (set to your mobile app's domain or '*' for development)

## Deployment Options

### Option 1: Render.com (Recommended)

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Configure the service:
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add all environment variables from your `.env` file

### Option 2: Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t numira-api .
   ```

2. Run the container:
   ```bash
   docker run -p 8080:8080 --env-file .env numira-api
   ```

### Option 3: Traditional Hosting

1. Set up a Node.js environment on your server
2. Clone the repository and install dependencies
3. Set up environment variables
4. Use PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

## API Configuration for Mobile

The API has been optimized for mobile with:

- JWT authentication supporting Bearer token format
- Standardized JSON responses
- Proper error handling
- Compression for reduced data transfer
- Health check endpoints for monitoring
- Rate limiting to prevent abuse

### Testing Mobile Connectivity

1. Deploy the API to your chosen platform
2. Use the health check endpoint to verify the API is running:
   ```
   GET https://your-api-url.com/api/health
   ```
3. Test authentication:
   ```
   POST https://your-api-url.com/api/auth
   Content-Type: application/json
   
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```
4. Use the returned token in subsequent requests:
   ```
   GET https://your-api-url.com/api/conversations
   Authorization: Bearer your_token_here
   ```

## Security Considerations

1. **HTTPS**: Ensure your API is served over HTTPS only
2. **JWT Tokens**: Store securely in your mobile app (use secure storage)
3. **API Keys**: Never expose API keys in your mobile app; use the backend as a proxy
4. **Rate Limiting**: The API includes rate limiting to prevent abuse
5. **Input Validation**: All endpoints validate input data

## Monitoring and Scaling

1. Use the `/api/health` endpoints to monitor API status
2. Set up alerts for server errors and high response times
3. Monitor database performance
4. Scale horizontally by adding more instances as needed

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your CORS settings include your mobile app's domain
2. **Authentication Failures**: Check JWT token expiration and format
3. **Database Connection Issues**: Verify database credentials and connectivity
4. **Rate Limiting**: Check if you're hitting rate limits during testing

### Debugging

1. Check server logs:
   ```
   GET https://your-api-url.com/api/health/detailed
   ```
2. Enable detailed logging by setting `LOG_LEVEL=debug` in your environment
3. For local testing, run the server with:
   ```bash
   NODE_ENV=development npm run dev
   ```

---

For additional support, please open an issue on the GitHub repository or contact the development team.
