#!/bin/bash
# Numira Bootstrap Script
# This script sets up the Numira application for local or cloud deployment.

set -e  # Exit immediately if a command exits with a non-zero status

# Print colorful messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}  Numira Application Bootstrap Script  ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}Warning: .env file not found. Creating from .env.sample...${NC}"
  if [ -f .env.sample ]; then
    cp .env.sample .env
    echo -e "${GREEN}Created .env file from .env.sample. Please update with your configuration.${NC}"
  else
    echo -e "${RED}Error: .env.sample file not found. Please create a .env file manually.${NC}"
    exit 1
  fi
fi

# Step 1: Install dependencies
echo -e "\n${BLUE}Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed successfully.${NC}"

# Step 2: Run Prisma migrations
echo -e "\n${BLUE}Step 2: Running database migrations...${NC}"
npx prisma migrate dev --name init
echo -e "${GREEN}✓ Database migrations completed successfully.${NC}"

# Step 3: Seed the database
echo -e "\n${BLUE}Step 3: Seeding the database with default data...${NC}"
node scripts/seed.js
echo -e "${GREEN}✓ Database seeded successfully.${NC}"

# Step 4: Verify environment
echo -e "\n${BLUE}Step 4: Verifying environment...${NC}"
node scripts/verify-env.js
echo -e "${GREEN}✓ Environment verification completed.${NC}"

# Print success message
echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}  Numira Application Setup Complete!   ${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "\n${BLUE}You can now start the application with:${NC}"
echo -e "  ${YELLOW}npm run start:dev${NC}  - For development with hot reloading"
echo -e "  ${YELLOW}npm run start:prod${NC} - For production"
echo -e "\n${BLUE}Test user credentials:${NC}"
echo -e "  ${YELLOW}Email:${NC} test@example.com"
echo -e "  ${YELLOW}Password:${NC} password123"
echo -e "\n${BLUE}For more information, see the documentation:${NC}"
echo -e "  ${YELLOW}docs/DEPLOYMENT_GUIDE.md${NC}"
echo -e "  ${YELLOW}docs/SYSTEM_ARCHITECTURE.md${NC}"
