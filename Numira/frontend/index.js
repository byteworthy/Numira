import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Entry point for the Numira frontend application
 * 
 * Renders the main App component to the DOM
 */

// Create a root for the React application
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component to the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
