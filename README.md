# Numira - AI-Powered Mental Clarity App

Numira is a full-stack web and mobile application designed to help users process their thoughts and emotions through AI-guided conversations. The app provides a safe, supportive environment for reflection and personal growth.

## Features

- **User Authentication**: Secure signup and login system
- **Persona Selection**: Choose between different AI personalities to match your preferred style of reflection
  - **Ayla**: A nurturing and empathetic guide who helps you explore your thoughts with compassion
  - **Cam**: A direct and insightful coach who helps you gain clarity through straightforward questions
- **Conversation Interface**: Intuitive chat interface for journaling and reflection
- **Insights Generation**: AI-powered analysis of conversations to identify patterns and key takeaways
- **User Preferences**: Customize your experience with theme selection and default persona settings
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Mobile App Support**: Native mobile app experience via CapacitorJS
- **Offline Functionality**: Continue using the app even without an internet connection
- **Touch-Optimized UI**: Designed for comfortable mobile interaction

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- OpenAI API Integration

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
numira/
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
├── middleware/             # Express middleware
├── models/                 # Mongoose models
├── routes/                 # API routes
│   └── api/                # API endpoints
├── scripts/                # Utility scripts
├── services/               # Service modules
├── .env                    # Environment variables
├── package.json            # Project dependencies
├── server.js               # Express server entry point
└── MOBILE_DEPLOYMENT_GUIDE.md # Guide for mobile deployment
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- OpenAI API key
- For mobile development:
  - Android Studio (for Android)
  - Xcode (for iOS, macOS only)

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/numira.git
cd numira
```

2. Install server dependencies
```
npm install
```

3. Install client dependencies
```
cd client
npm install
cd ..
```

4. Create a `.env` file in the root directory with the following variables:
```
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
```

5. Seed the database with initial data (personas)
```
node scripts/seedDatabase.js
```

6. Run the development server
```
npm run dev
```

This will start both the backend server and the React frontend in development mode.

## Deployment

### Web Deployment
The application is designed to be deployable to Replit and can connect to external APIs via Make.com if needed.

### Mobile Deployment
For deploying as a native mobile application:

1. Build the React application
```
cd client
npm run build
```

2. Initialize Capacitor and add platforms
```
npm run cap:init
npm run cap:add:android  # For Android
npm run cap:add:ios      # For iOS (macOS only)
```

3. Sync the web code with the native projects
```
npm run cap:sync
```

4. Open the native projects
```
npm run cap:open:android  # For Android
npm run cap:open:ios      # For iOS (macOS only)
```

For detailed instructions on building and submitting to app stores, see the [Mobile Deployment Guide](MOBILE_DEPLOYMENT_GUIDE.md).

## Offline Functionality

The mobile app includes offline capabilities:
- Conversations are cached locally for offline viewing
- Users can compose messages while offline
- Data automatically syncs when the device reconnects
- Service workers cache static assets for faster loading

## License

This project is licensed under the MIT License - see the LICENSE file for details.
