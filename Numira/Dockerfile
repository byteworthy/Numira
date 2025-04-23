FROM node:18.17.1-alpine3.18 AS base

# Add metadata
LABEL maintainer="Byteworthy <support@byteworthy.com>"
LABEL description="Numira - AI-Powered Mental Clarity App"
LABEL version="1.0.0"

# Create app directory
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 numira

# Install dependencies for node-gyp and other native modules
RUN apk add --no-cache python3 make g++ curl

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build the app
FROM deps AS builder
COPY . .
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Set security-related environment variables
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=8192"
ENV NPM_CONFIG_AUDIT=true
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_LOGLEVEL=warn

# Copy only necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/config ./config
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/processors ./processors
COPY --from=builder /app/promptEngine ./promptEngine
COPY --from=builder /app/promptLibrary ./promptLibrary
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/webhooks ./webhooks
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/TERMS_OF_SERVICE.md ./TERMS_OF_SERVICE.md
COPY --from=builder /app/LICENSE ./LICENSE

# Copy client build if it exists
COPY --from=builder /app/client/build ./client/build

# Add wait-for-it script to wait for dependencies
COPY --from=builder /app/scripts/wait-for-it.sh ./scripts/wait-for-it.sh
RUN chmod +x ./scripts/wait-for-it.sh \
    && chown numira:nodejs ./scripts/wait-for-it.sh

# Create logs directory with proper permissions
RUN mkdir -p logs \
    && chown -R numira:nodejs logs

# Switch to non-root user
USER numira

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Expose port
EXPOSE ${PORT:-3000}

# Start the app with security flags
CMD ["node", "--no-deprecation", "--disallow-code-generation-from-strings", "--disable-proto=throw", "server.js"]
