# Multi-stage build for optimized production image

# Build stage for client assets
FROM node:18-alpine AS client-builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci --only=production
COPY client ./client/
RUN cd client && npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server code
COPY . .

# Remove development files and client source
RUN rm -rf client/src client/node_modules client/public

# Copy built client assets from build stage
COPY --from=client-builder /app/client/build ./client/build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
