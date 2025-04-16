import React, { useState, useContext, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  TextField,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Logout as LogoutIcon,
  Info as InfoIcon,
  Fingerprint as FingerprintIcon,
  VolumeUp as VolumeUpIcon,
  Language as LanguageIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { AlertContext } from '../context/AlertContext';
import SecureStorage from '../utils/secureStorage';
import NotificationService from '../utils/notificationService';
import BiometricAuth from '../utils/biometricAuth';
import OfflineStorage from '../utils/offlineStorage';
import PlatformUtils from '../utils/platformUtils';
import AnalyticsService from '../utils/analyticsService';

const Settings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const { setAlert } = useContext(AlertContext);
  
  // State for settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [storageUsage, setStorageUsage] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load notification settings
        const notifEnabled = await SecureStorage.getItem('notifications_enabled', false);
        setNotificationsEnabled(notifEnabled === true);
        
        // Load biometric settings
        const bioEnabled = await SecureStorage.getItem('biometric_enabled', false);
        setBiometricEnabled(bioEnabled === true);
        
        // Load sound settings
        const soundEnabled = await SecureStorage.getItem('sound_enabled', true);
        setSoundEnabled(soundEnabled !== false); // Default to true
        
        // Load offline mode settings
        const offlineEnabled = await SecureStorage.getItem('offline_mode', false);
        setOfflineMode(offlineEnabled === true);
        
        // Load language settings
        const lang = await SecureStorage.getItem('language', 'en');
        setLanguage(lang || 'en');
        
        // Calculate storage usage
        const usage = await OfflineStorage.getStorageUsage();
        setStorageUsage(usage);
        
        // Track page view
        AnalyticsService.trackEvent('page_view', {
          page: 'settings'
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setAlert('Failed to load settings', 'error');
        setLoading(false);
      }
    };
    
    loadSettings();
  }, [setAlert]);
  
  // Handle dark mode toggle
  const handleDarkModeToggle = () => {
    toggleDarkMode();
    
    // Track event
    AnalyticsService.trackEvent('setting_changed', {
      setting: 'dark_mode',
      value: !darkMode
    });
  };
  
  // Handle notifications toggle
  const handleNotificationsToggle = async () => {
    try {
      const newValue = !notificationsEnabled;
      
      if (newValue) {
        // Request permission
        const permission = await NotificationService.requestPermission();
        
        if (!permission) {
          setAlert('Notification permission denied', 'warning');
          return;
        }
      }
      
      // Save setting
      await SecureStorage.setItem('notifications_enabled', newValue, false);
      setNotificationsEnabled(newValue);
      
      // Track event
      AnalyticsService.trackEvent('setting_changed', {
        setting: 'notifications',
        value: newValue
      });
    } catch (error) {
      console.error('Error toggling notifications:', error);
      setAlert('Failed to update notification settings', 'error');
    }
  };
  
  // Handle biometric toggle
  const handleBiometricToggle = async () => {
    try {
      const newValue = !biometricEnabled;
      
      if (newValue) {
        // Check if biometric is available
        const available = await BiometricAuth.isAvailable();
        
        if (!available) {
          setAlert('Biometric authentication is not available on this device', 'warning');
          return;
        }
        
        // Verify biometric
        const verified = await BiometricAuth.authenticate('Verify your identity to enable biometric login');
        
        if (!verified) {
          setAlert('Biometric verification failed', 'error');
          return;
        }
      }
      
      // Save setting
      await SecureStorage.setItem('biometric_enabled', newValue, true);
      setBiometricEnabled(newValue);
      
      // Track event
      AnalyticsService.trackEvent('setting_changed', {
        setting: 'biometric',
        value: newValue
      });
    } catch (error) {
      console.error('Error toggling biometric:', error);
      setAlert('Failed to update biometric settings', 'error');
    }
  };
  
  // Handle sound toggle
  const handleSoundToggle = async () => {
    try {
      const newValue = !soundEnabled;
      
      // Save setting
      await SecureStorage.setItem('sound_enabled', newValue, false);
      setSoundEnabled(newValue);
      
      // Play sound if enabled
      if (newValue && Capacitor.isNativePlatform()) {
        PlatformUtils.playSound('toggle');
      }
      
      // Track event
      AnalyticsService.trackEvent('setting_changed', {
        setting: 'sound',
        value: newValue
      });
    } catch (error) {
      console.error('Error toggling sound:', error);
      setAlert('Failed to update sound settings', 'error');
    }
  };
  
  // Handle offline mode toggle
  const handleOfflineModeToggle = async () => {
    try {
      const newValue = !offlineMode;
      
      // Save setting
      await SecureStorage.setItem('offline_mode', newValue, false);
      setOfflineMode(newValue);
      
      // Track event
      AnalyticsService.trackEvent('setting_changed', {
        setting: 'offline_mode',
        value: newValue
      });
      
      // Show info message
      if (newValue) {
        setSnackbar({
          open: true,
          message: 'Offline mode enabled. Conversations will be stored locally and synced when online.',
          severity: 'info'
        });
      }
    } catch (error) {
      console.error('Error toggling offline mode:', error);
      setAlert('Failed to update offline mode settings', 'error');
    }
  };
  
  // Handle language change
  const handleLanguageChange = async (newLanguage) => {
    try {
      // Save setting
      await SecureStorage.setItem('language', newLanguage, false);
      setLanguage(newLanguage);
      
      // Track event
      AnalyticsService.trackEvent('setting_changed', {
        setting: 'language',
        value: newLanguage
      });
      
      // Show info message
      setSnackbar({
        open: true,
        message: 'Language updated. Some changes may require a restart to take effect.',
        severity: 'info'
      });
    } catch (error) {
      console.error('Error changing language:', error);
      setAlert('Failed to update language settings', 'error');
    }
  };
  
  // Handle clear storage
  const handleClearStorage = async () => {
    try {
      // Clear offline storage
      await OfflineStorage.clearStorage();
      
      // Update storage usage
      const usage = await OfflineStorage.getStorageUsage();
      setStorageUsage(usage);
      
      // Track event
      AnalyticsService.trackEvent('storage_cleared');
      
      // Show success message
      setAlert('Local storage cleared successfully', 'success');
    } catch (error) {
      console.error('Error clearing storage:', error);
      setAlert('Failed to clear storage', 'error');
    }
  };
  
  // Handle export data
  const handleExportData = async () => {
    try {
      // Get user data
      const userData = await axios.get('/api/users/export');
      
      // Create download link
      const dataStr = JSON.stringify(userData.data);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      // Create download link
      const exportFileDefaultName = `numira-data-${new Date().toISOString()}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      // Track event
      AnalyticsService.trackEvent('data_exported');
      
      // Show success message
      setAlert('Data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      setAlert('Failed to export data', 'error');
    }
  };
  
  // Handle delete account
  const handleDeleteAccount = async () => {
    try {
      // Verify confirmation text
      if (deleteConfirmText !== 'DELETE') {
        setAlert('Please type DELETE to confirm account deletion', 'error');
        return;
      }
      
      // Delete account
      await axios.delete('/api/users');
      
      // Track event
      AnalyticsService.trackEvent('account_deleted');
      
      // Logout user
      logout();
      
      // Navigate to home
      navigate('/');
      
      // Show success message
      setAlert('Account deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting account:', error);
      setAlert('Failed to delete account', 'error');
    } finally {
      // Close dialog
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
    }
  };
  
  // Handle snackbar close
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    
    setSnackbar({
      ...snackbar,
      open: false
    });
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Appearance
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <DarkModeIcon color={darkMode ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Dark Mode" 
              secondary="Use dark theme for the application"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={darkMode}
                onChange={handleDarkModeToggle}
                inputProps={{ 'aria-label': 'dark mode toggle' }}
              />
            </ListItemSecondaryAction>
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Language" 
              secondary="Select your preferred language"
            />
            <ListItemSecondaryAction>
              <Button
                size="small"
                onClick={() => handleLanguageChange('en')}
                variant={language === 'en' ? 'contained' : 'outlined'}
                sx={{ mr: 1, minWidth: 40 }}
              >
                EN
              </Button>
              <Button
                size="small"
                onClick={() => handleLanguageChange('es')}
                variant={language === 'es' ? 'contained' : 'outlined'}
                sx={{ mr: 1, minWidth: 40 }}
              >
                ES
              </Button>
              <Button
                size="small"
                onClick={() => handleLanguageChange('fr')}
                variant={language === 'fr' ? 'contained' : 'outlined'}
                sx={{ minWidth: 40 }}
              >
                FR
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Notifications & Sound
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <NotificationsIcon color={notificationsEnabled ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Notifications" 
              secondary="Receive notifications for new insights and reminders"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={notificationsEnabled}
                onChange={handleNotificationsToggle}
                inputProps={{ 'aria-label': 'notifications toggle' }}
              />
            </ListItemSecondaryAction>
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <VolumeUpIcon color={soundEnabled ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Sound Effects" 
              secondary="Play sounds for actions and notifications"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={soundEnabled}
                onChange={handleSoundToggle}
                inputProps={{ 'aria-label': 'sound toggle' }}
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Privacy & Security
        </Typography>
        
        <List>
          {Capacitor.isNativePlatform() && (
            <>
              <ListItem>
                <ListItemIcon>
                  <FingerprintIcon color={biometricEnabled ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText 
                  primary="Biometric Authentication" 
                  secondary="Use fingerprint or face recognition to unlock the app"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={biometricEnabled}
                    onChange={handleBiometricToggle}
                    inputProps={{ 'aria-label': 'biometric toggle' }}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <Divider variant="inset" component="li" />
            </>
          )}
          
          <ListItem>
            <ListItemIcon>
              <StorageIcon color={offlineMode ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Offline Mode" 
              secondary="Store conversations locally and sync when online"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={offlineMode}
                onChange={handleOfflineModeToggle}
                inputProps={{ 'aria-label': 'offline mode toggle' }}
              />
            </ListItemSecondaryAction>
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <DownloadIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Export Your Data" 
              secondary="Download all your data in JSON format"
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                size="small"
                onClick={handleExportData}
                startIcon={<DownloadIcon />}
              >
                Export
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText 
              primary="Clear Local Storage" 
              secondary={`Current usage: ${storageUsage ? `${(storageUsage / 1024 / 1024).toFixed(2)} MB` : 'Calculating...'}`}
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleClearStorage}
              >
                Clear
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Account
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Account Information" 
              secondary={`Email: ${user?.email}`}
            />
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Logout" 
              secondary="Sign out of your account"
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                size="small"
                onClick={logout}
                startIcon={<LogoutIcon />}
              >
                Logout
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="error" />
            </ListItemIcon>
            <ListItemText 
              primary="Delete Account" 
              secondary="Permanently delete your account and all data"
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>
      
      {/* Delete Account Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action cannot be undone. All your data, including conversations and insights, will be permanently deleted.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
            To confirm, please type DELETE in the field below:
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteAccount} color="error">
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Settings;
