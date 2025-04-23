#!/bin/bash

# Numira Setup Script
# This script automates the setup process for the Numira application

echo "🚀 Starting Numira setup..."

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
if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies. Please check the error messages above."
  exit 1
fi
echo "✅ Dependencies installed successfully."

# Step 3: Set up the database
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
