#!/bin/bash

# Numira Setup Script
# This script automates the setup process for the Numira application

echo "🚀 Starting Numira setup..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "\"name\": \"numira\"" package.json; then
  echo "⚠️ Not in the Numira directory. Checking for Numira subdirectory..."
  
  if [ -d "Numira" ] && [ -f "Numira/package.json" ] && grep -q "\"name\": \"numira\"" Numira/package.json; then
    echo "📂 Found Numira directory. Changing to Numira directory..."
    cd Numira
  else
    echo "❌ Could not find Numira directory. Please run this script from the Numira directory or its parent directory."
    exit 1
  fi
fi

# Step 1: Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file from .env.sample..."
  cp .env.sample .env
  echo "✅ Created .env file. Please update it with your actual configuration values."
else
  echo "✅ .env file already exists."
fi

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm install

# If npm install fails, try again without anthropic
if [ $? -ne 0 ]; then
  echo "⚠️ Initial dependency installation failed. This might be due to the anthropic package."
  echo "📦 Trying to install without the anthropic package..."
  
  # Remove anthropic from package.json and try again
  sed -i 's/"anthropic": ".*",//' package.json
  npm install
  
  if [ $? -ne 0 ]; then
    echo "❌ Dependency installation still failed. Please check the error messages above."
    exit 1
  else
    echo "✅ Dependencies installed successfully (without anthropic package)."
  fi
else
  echo "✅ Dependencies installed successfully."
fi

# Step 3: Install OpenSSL 1.1 for Prisma
echo "📦 Installing OpenSSL 1.1 for Prisma..."
# For Replit environment
if command -v replit-install &> /dev/null; then
  replit-install openssl1.1
elif command -v apt-get &> /dev/null; then
  # For Debian/Ubuntu environments
  apt-get update && apt-get install -y openssl libssl1.1
elif command -v nix-env &> /dev/null; then
  # For Nix environments
  nix-env -i openssl_1_1
else
  echo "⚠️ Could not install OpenSSL 1.1. Attempting to continue anyway..."
fi

# Step 4: Set up the database
echo "🗄️ Setting up the database..."
node scripts/setup-database.js
if [ $? -ne 0 ]; then
  echo "❌ Failed to set up the database. Please check the error messages above."
  exit 1
fi
echo "✅ Database setup completed."

# Step 4: Seed the database
echo "🌱 Seeding the database..."
node scripts/seed.js
if [ $? -ne 0 ]; then
  echo "⚠️ Database seeding encountered issues. This might be expected if some data already exists."
else
  echo "✅ Database seeded successfully."
fi

echo ""
echo "🎉 Numira setup completed!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env file is configured correctly"
echo "2. Start the server with: npm start"
echo "3. For development, use: npm run start:dev"
echo ""
