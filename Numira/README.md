# Numira - AI-Powered Mental Clarity App

<div align="center">
  <h3>Mental Clarity Through AI-Guided Conversations</h3>
</div>

Numira is a full-stack web and mobile application designed to help users process their thoughts and emotions through AI-guided conversations. The app provides a safe, supportive environment for reflection and personal growth.

> **IMPORTANT DISCLAIMER**: Numira is not a medical tool. It is a personal thought companion. It does not provide therapy, mental health advice, or diagnosis of any kind. The AI personas are designed for self-reflection only and should never be used as a substitute for professional medical or mental health services.

## 📚 Documentation

- [Project Planning & Architecture](docs/SYSTEM_ARCHITECTURE.md) - Vision, architecture, and roadmap
- [API Documentation](docs/API_DOCUMENTATION.md) - API endpoints and usage
- [Database Schema](docs/DATABASE_SCHEMA.md) - Database structure and relationships
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Instructions for deployment
- [Maintenance & Troubleshooting](docs/MAINTENANCE_TROUBLESHOOTING.md) - Common issues and solutions
- [Offline Functionality](docs/OFFLINE_FUNCTIONALITY.md) - How offline mode works
- [Push Notifications](docs/PUSH_NOTIFICATIONS.md) - Push notification implementation
- [Payment Integration](docs/PAYMENT_INTEGRATION.md) - Stripe and RevenueCat integration
- [Family Plan](docs/FAMILY_PLAN.md) - Family plan implementation
- [Platform Scale](docs/PLATFORM_SCALE.md) - Scaling considerations
- [Prisma Replit Setup](docs/PRISMA_REPLIT_SETUP.md) - Fixing OpenSSL issues with Prisma in Replit

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/byteworthy/Numira.git

# Navigate to the project directory
cd Numira

# Install dependencies
npm install && cd client && npm install && cd ..

# Set up environment variables
cp .env.sample .env
# Edit .env with your own values

# Start the development server
npm run dev
```

## Features

- **User Authentication**: Secure signup and login system
- **Persona Selection**: Choose between different AI personalities to match your preferred style of reflection
  - **Ayla**: A nurturing and empathetic guide who helps you explore your thoughts with compassion
  - **Cam**: A direct and insightful coach who helps you gain clarity through straightforward questions
  - **Rumi**: A philosophical guide who helps you explore deeper meaning and purpose
  - **Jax**: A practical problem-solver who helps you break down challenges into actionable steps
- **Conversation Interface**: Intuitive chat interface for journaling and reflection
- **Journal System**: Save and review past conversations with different personas in various rooms
- **Insights Generation**: AI-powered analysis of conversations to identify patterns and key takeaways
- **User Preferences**: Customize your experience with theme selection and default persona settings
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Mobile App Support**: Native mobile app experience via CapacitorJS
- **Offline Functionality**: Continue using the app even without an internet connection
- **Touch-Optimized UI**: Designed for comfortable mobile interaction
- **Background Processing**: Asynchronous job processing for email, notifications, reports, and cleanup tasks
- **System Monitoring**: Comprehensive metrics API for monitoring system health and performance
- **Automated Testing**: End-to-end testing for critical user flows
- **Daily System Checks**: Automated health checks with email reporting

## Tech Stack

### Backend
- Node.js
- Express.js
- PostgreSQL
- Redis (for Bull queues and caching)
- JWT Authentication
- OpenAI API Integration
- Bull Queue for background processing

### Frontend
- React
- React Router
- Material UI
- Axios
- Context API for state management
- Service Workers for offline capabilities

### Mobile
- CapacitorJS for native mobile app conversion
- Native device storage for offline data
- Touch-optimized UI components
- Splash screen and status bar integration

## Project Structure

```
Numira/
├── client/                 # Frontend React application
│   ├── public/             # Static files
│   ├── android/            # Android platform (after capacitor add)
│   ├── ios/                # iOS platform (after capacitor add)
│   └── src/                # React source code
│       ├── components/     # Reusable UI components
│       ├── context/        # Context providers for state management
│       ├── pages/          # Page components
│       └── utils/          # Utility functions
├── config/                 # Configuration files
├── controllers/            # Request handlers
├── middleware/             # Express middleware
├── models/                 # Database models
├── processors/             # Background job processors
│   ├── emailProcessor.js   # Email sending processor
│   ├── reportProcessor.js  # Report generation processor
│   ├── cleanupProcessor.js # Data cleanup processor
│   ├── notificationProcessor.js # Push notification processor
│   └── index.js            # Processor exports
├── promptEngine/           # AI prompt engineering system
│   ├── personas/           # AI persona definitions
│   ├── rooms/              # Conversation context definitions
│   └── promptEngine.js     # Core prompt engine
├── promptLibrary/          # Additional prompts and experiments
├── routes/                 # API routes
│   └── api/                # API endpoints
├── scripts/                # Utility scripts
├── services/               # Service modules
│   ├── queueService.js     # Bull queue service
│   ├── aiService.js        # AI service
│   ├── authService.js      # Authentication service
│   └── ...                 # Other services
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── utils/                  # Utility functions
│   └── logger.js           # Winston logger
├── webhooks/               # Webhook handlers
├── .env                    # Environment variables
├── .env.sample             # Environment variables template
├── package.json            # Project dependencies
└── server.js               # Express server entry point
```

## Background Job Processing System

Numira uses Bull, a Redis-based queue system, for processing background jobs. This allows the application to handle time-consuming tasks asynchronously, improving the user experience and application performance.

### Queue Types

- **Email Queue**: Handles sending emails for user notifications, reports, and system alerts
- **Report Queue**: Generates PDF reports for user activity, conversation insights, and system analytics
- **Cleanup Queue**: Performs routine cleanup tasks like removing old data, temporary files, and expired sessions
- **Notification Queue**: Manages push notifications for mobile and web clients

### Job Processors

Each queue has a dedicated processor that handles the specific job type:

- **emailProcessor.js**: Sends emails using Nodemailer
- **reportProcessor.js**: Generates PDF reports using PDFKit
- **cleanupProcessor.js**: Performs cleanup tasks for files, database records, and logs
- **notificationProcessor.js**: Sends push notifications using Web Push

### Scheduled Jobs

The system also supports scheduled jobs for recurring tasks:

- Daily backup at 2 AM
- Daily system check at 4 AM
- Weekly cleanup at 3 AM on Sundays

### Queue Monitoring

The Bull Board UI is available at `/admin/queues` for monitoring queue status, job progress, and errors.

## System Monitoring

Numira includes a comprehensive monitoring system to ensure optimal performance and reliability.

### Metrics API

The metrics API provides detailed information about system health and performance:

- **Public Metrics** (`/api/metrics`): Basic system status information
- **System Metrics** (`/api/metrics/system`): Detailed system information including CPU, memory, and disk usage
- **Database Metrics** (`/api/metrics/database`): Database statistics and entity counts
- **AI Metrics** (`/api/metrics/ai`): AI usage statistics and costs
- **Queue Metrics** (`/api/metrics/queues`): Queue status and performance
- **Audit Metrics** (`/api/metrics/audit`): Audit log statistics
- **Summary** (`/api/metrics/summary`): Human-readable summary of system metrics

### Daily System Check

The system performs an automated health check daily at 4 AM that:

1. Collects comprehensive system metrics
2. Identifies potential issues based on predefined thresholds
3. Generates a detailed report
4. Sends email notifications to administrators when issues are detected
5. Stores reports in the database for historical analysis

This proactive monitoring helps identify and address issues before they impact users.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)
- OpenAI API key
- Git
- For mobile development:
  - Android Studio (for Android)
  - Xcode (for iOS, macOS only)
  - Capacitor CLI (`npm install -g @capacitor/cli`)

### Automated Installation

We've created an automated setup script that handles the entire installation process:

1. Clone the repository
```
git clone https://github.com/byteworthy/Numira.git
cd Numira
```

2. Run the setup script
```
./setup.sh
```

This script will:
- Create a `.env` file from `.env.sample` if it doesn't exist
- Install all dependencies
- Set up the database and generate the Prisma client
- Seed the database with initial data

3. Start the development server
```
npm run dev
```

### Manual Installation

If you prefer to install manually:

1. Clone the repository
```
git clone https://github.com/byteworthy/Numira.git
cd Numira
```

2. Create a `.env` file in the root directory based on the provided `.env.sample`:
```bash
# Copy the example file
cp .env.sample .env

# Edit the file with your own values
nano .env  # or use your preferred editor
```

3. Install server dependencies
```
npm install
```

4. Install client dependencies
```
cd client
npm install
cd ..
```

5. Set up the database and generate the Prisma client
```
node scripts/setup-database.js
```

6. Seed the database with initial data
```
node scripts/seed.js
```

7. Start the development server
```
npm run dev
```

This will start both the backend server and the React frontend in development mode.

### Troubleshooting Installation Issues

If you encounter any of these issues during installation:

1. **Anthropic package version error**: We've updated the package.json to use version 0.3.0 of the Anthropic package, which is compatible with npm. If you still encounter issues, you can try removing the anthropic dependency if you're not using it directly:
   ```bash
   # Edit package.json and remove the anthropic line, or run:
   npm uninstall anthropic
   ```

2. **Prisma migration issues**: The `setup-database.js` script handles creating a baseline migration for existing databases.

3. **Missing @prisma/client module**: The setup script ensures the Prisma client is generated before running the seed script.

4. **Directory navigation issues**: The setup script now automatically detects whether it's being run from the Numira directory or its parent directory and adjusts accordingly.

5. **Prisma OpenSSL errors in Replit**: If you encounter errors like `Unable to require libquery_engine-debian-openssl-1.1.x.so.node` or `Prisma cannot find the required libssl system library`, see our [Prisma Replit Setup](docs/PRISMA_REPLIT_SETUP.md) guide. We've updated the setup script to automatically install OpenSSL 1.1.x and configured Prisma to use compatible binary targets.

6. **YAML syntax errors in workflow files**: If you encounter YAML syntax errors in files like mobile-build.yml, ensure that the file has proper indentation and structure. YAML is sensitive to whitespace and requires consistent indentation.

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reloading
- `npm run client` - Start the React client development server
- `npm run dev:full` - Start both backend and frontend development servers
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run e2e:test` - Run end-to-end tests that verify the complete user flow
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and automatically fix issues
- `npm run seed` - Seed the database with initial data
- `npm run setup:test` - Set up the test environment
- `npm run setup:cron` - Set up cron jobs for scheduled tasks
- `npm run verify:env` - Verify environment variables are properly set

## License

This project is licensed under the MIT License - see the LICENSE file for details.
