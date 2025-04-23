# Numira Frontend

This is the frontend application for Numira, a self-reflection and journaling application that uses AI personas to help users process their thoughts and emotions.

## Overview

The Numira frontend is a React application that provides a user interface for interacting with the Numira backend API. It allows users to:

- Select from different AI personas (guides) with unique personalities and approaches
- Choose different rooms (contexts) for conversations
- Have conversations with the selected persona in the selected room
- Save conversations to a journal for future reference
- View and manage journal entries

## Project Structure

```
frontend/
├── api/                  # API utility functions
│   ├── fetchPersonas.js  # Fetch personas from the backend
│   ├── fetchRooms.js     # Fetch rooms from the backend
│   ├── fetchGPTResponse.js # Send prompts to AI and get responses
│   ├── fetchJournals.js  # Fetch journal entries
│   └── postJournal.js    # Create new journal entries
├── components/           # React components
│   ├── PersonaSelector.jsx # Component for selecting personas
│   ├── RoomSelector.jsx  # Component for selecting rooms
│   ├── PromptInput.jsx   # Component for entering prompts
│   ├── GPTResponseBox.jsx # Component for displaying AI responses
│   ├── JournalToggle.jsx # Component for toggling journal saving
│   └── JournalList.jsx   # Component for displaying journal entries
├── public/               # Public assets
│   ├── index.html        # HTML entry point
│   └── styles.css        # CSS styles
├── App.jsx               # Main application component
├── index.js              # JavaScript entry point
├── package.json          # Project dependencies and scripts
└── README.md             # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Navigate to the frontend directory:
   ```
   cd Numira/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

The application will be available at http://localhost:3000.

## Development

### API Utilities

The `api` directory contains utility functions for interacting with the backend API. These functions handle authentication, error handling, and data formatting.

### Components

The `components` directory contains React components that make up the user interface. Each component is responsible for a specific part of the UI and is designed to be reusable.

### Styling

The application uses CSS for styling, with styles defined in `public/styles.css`. The styles use CSS variables for consistent theming and are organized by component.

## Backend Integration

The frontend communicates with the Numira backend API, which provides endpoints for:

- Authentication
- Personas and rooms
- AI conversations
- Journal entries

The API base URL is configured in `package.json` using the `proxy` field, which is set to `http://localhost:3001` for development.

## Features

### Persona Selection

Users can select from different AI personas, each with a unique personality and approach to conversations.

### Room Selection

Users can choose different rooms (contexts) for conversations, which influence the tone and focus of the AI's responses.

### Conversations

Users can have conversations with the selected persona in the selected room, with the AI providing responses based on the persona and room.

### Journaling

Users can save conversations to a journal for future reference and view their journal entries.
