# Numira
# Numira - AI-Powered Mental Clarity App

Numira is a full-stack web application designed to help users process their thoughts and emotions through AI-assisted journaling and reflection.


## Features


- **User Authentication**: Secure signup and login functionality

- **Multiple AI Personas**: Choose between different AI personalities (nurturing "Ayla" and direct "Cam")

- **Conversation Interface**: Intuitive chat interface for journaling and reflection

- **Insights Generation**: AI-generated insights from your conversations

- **User Profiles**: Manage your account and view conversation history

- **Responsive Design**: Works on desktop and mobile devices

- **Offline Support**: Continue using the app even without an internet connection

- **Dark Mode**: Toggle between light and dark themes

- **Content Moderation**: Ensures all AI responses are safe and appropriate


## Tech Stack


### Backend

- Node.js

- Express

- MongoDB

- JWT Authentication

- OpenAI/Claude API Integration


### Frontend

- React

- Material-UI

- React Router

- Context API for state management

- Progressive Web App (PWA) capabilities


## Project Structure


```
numira/
├── client/                 # Frontend React application
│   ├── public/             # Static files
│   └── src/                # React source code
│       ├── components/     # Reusable UI components
│       ├── context/        # React Context providers
│       ├── pages/          # Page components
│       ├── theme/          # Theme configuration
│       └── utils/          # Utility functions
├── config/                 # Configuration files
├── middleware/             # Express middleware
├── models/                 # Mongoose models
├── routes/                 # API routes
│   └── api/                # API endpoints
├── services/               # Service modules
│   ├── aiService.js        # AI integration service
│   └── moderationService.js # Content moderation service
└── utils/                  # Utility functions
    └── logger.js           # Logging utility
```


## Getting Started


1. Clone the repository

2. Install dependencies:

   ```
   npm install
   cd client
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Run the development server:

   ```
   npm run dev:full
   ```


## Mobile Deployment


The app can be deployed as a native mobile application using Capacitor. See `MOBILE_DEPLOYMENT_GUIDE.md` for detailed instructions.


## License


MIT
