import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { Capacitor } from '@capacitor/core';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();

// Initialize Capacitor when running as a native app
if (Capacitor.isNativePlatform()) {
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide();
  });
  
  import('@capacitor/status-bar').then(({ StatusBar }) => {
    StatusBar.setBackgroundColor({ color: '#8A6FDF' });
  });
}
