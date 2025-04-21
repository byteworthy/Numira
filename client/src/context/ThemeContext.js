import React, { createContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import lightTheme from '../theme/lightTheme';
import darkTheme from '../theme/darkTheme';
import { Capacitor } from '@capacitor/core';
import SecureStorage from '../utils/secureStorage';

// Create theme context
export const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
  systemPreference: 'light',
  useSystemTheme: false,
  setUseSystemTheme: () => {},
});

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // State for theme mode
  const [mode, setMode] = useState('light');
  
  // State for system preference
  const [systemPreference, setSystemPreference] = useState('light');
  
  // State for using system theme
  const [useSystemTheme, setUseSystemTheme] = useState(false);
  
  // Get the active theme based on mode
  const theme = useMemo(() => {
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);
  
  // Function to toggle theme
  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    saveThemePreference(newMode, useSystemTheme);
  };
  
  // Function to set theme mode
  const setThemeMode = (newMode) => {
    setMode(newMode);
    saveThemePreference(newMode, useSystemTheme);
  };
  
  // Function to set use system theme
  const handleSetUseSystemTheme = (value) => {
    setUseSystemTheme(value);
    saveThemePreference(mode, value);
    
    // If enabling system theme, immediately apply system preference
    if (value) {
      setMode(systemPreference);
    }
  };
  
  // Function to save theme preference
  const saveThemePreference = async (themeMode, useSystem) => {
    try {
      const themePreference = {
        mode: themeMode,
        useSystemTheme: useSystem,
      };
      
      if (Capacitor.isNativePlatform()) {
        // Use secure storage for native platforms
        await SecureStorage.setItem('theme_preference', themePreference, false);
      } else {
        // Use localStorage for web
        localStorage.setItem('theme_preference', JSON.stringify(themePreference));
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };
  
  // Function to load theme preference
  const loadThemePreference = async () => {
    try {
      let themePreference;
      
      if (Capacitor.isNativePlatform()) {
        // Use secure storage for native platforms
        themePreference = await SecureStorage.getItem('theme_preference', false);
      } else {
        // Use localStorage for web
        const storedPreference = localStorage.getItem('theme_preference');
        themePreference = storedPreference ? JSON.parse(storedPreference) : null;
      }
      
      if (themePreference) {
        setUseSystemTheme(themePreference.useSystemTheme);
        
        if (themePreference.useSystemTheme) {
          // If using system theme, apply system preference
          setMode(systemPreference);
        } else {
          // Otherwise, apply saved mode
          setMode(themePreference.mode);
        }
      } else {
        // Default to light theme if no preference is saved
        setMode('light');
        setUseSystemTheme(false);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Default to light theme if there's an error
      setMode('light');
      setUseSystemTheme(false);
    }
  };
  
  // Effect to detect system theme preference
  useEffect(() => {
    // Check if the user has a preference for dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial system preference
    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');
    
    // Listen for changes in system preference
    const handleChange = (e) => {
      const newPreference = e.matches ? 'dark' : 'light';
      setSystemPreference(newPreference);
      
      // If using system theme, update mode
      if (useSystemTheme) {
        setMode(newPreference);
      }
    };
    
    // Add listener
    mediaQuery.addEventListener('change', handleChange);
    
    // Clean up
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [useSystemTheme]);
  
  // Effect to load theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);
  
  // Effect to apply theme to status bar on native platforms
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const applyStatusBarTheme = async () => {
        try {
          const { StatusBar } = await import('@capacitor/status-bar');
          
          if (mode === 'dark') {
            // Dark theme
            await StatusBar.setStyle({ style: StatusBar.Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#121212' });
          } else {
            // Light theme
            await StatusBar.setStyle({ style: StatusBar.Style.Light });
            await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
          }
        } catch (error) {
          console.error('Error applying status bar theme:', error);
        }
      };
      
      applyStatusBarTheme();
    }
  }, [mode]);
  
  // Context value
  const contextValue = {
    mode,
    toggleTheme,
    setThemeMode,
    systemPreference,
    useSystemTheme,
    setUseSystemTheme: handleSetUseSystemTheme,
  };
  
  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
