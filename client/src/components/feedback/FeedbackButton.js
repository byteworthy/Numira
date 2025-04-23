import React, { useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Box,
  useTheme
} from '@mui/material';
import { Feedback as FeedbackIcon } from '@mui/icons-material';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import AnalyticsService from '../../utils/analyticsService';
import PlatformUtils from '../../utils/platformUtils';

/**
 * Floating feedback button that opens a feedback form dialog
 */
const FeedbackButton = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [email, setEmail] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Handle opening the feedback dialog
  const handleOpen = () => {
    setOpen(true);
    
    // Track event
    AnalyticsService.trackEvent('feedback_dialog_opened');
  };

  // Handle closing the feedback dialog
  const handleClose = () => {
    setOpen(false);
    
    // Reset form
    setFeedbackType('suggestion');
    setFeedbackText('');
    setEmail('');
    setIncludeScreenshot(false);
    setScreenshot(null);
  };

  // Handle feedback type change
  const handleFeedbackTypeChange = (event) => {
    setFeedbackType(event.target.value);
  };

  // Handle feedback text change
  const handleFeedbackTextChange = (event) => {
    setFeedbackText(event.target.value);
  };

  // Handle email change
  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  // Handle include screenshot toggle
  const handleIncludeScreenshotToggle = () => {
    setIncludeScreenshot(!includeScreenshot);
    
    if (!includeScreenshot && Capacitor.isNativePlatform()) {
      captureScreenshot();
    } else {
      setScreenshot(null);
    }
  };

  // Capture screenshot (only on native platforms)
  const captureScreenshot = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      // This would use a Capacitor plugin to capture a screenshot
      // For example, using the ScreenshotPlugin
      // const { ScreenshotPlugin } = await import('@capacitor/screenshot');
      // const result = await ScreenshotPlugin.take();
      // setScreenshot(result.base64);
      
      // For now, we'll just simulate a screenshot
      setScreenshot('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setIncludeScreenshot(false);
    }
  };

  // Handle submit feedback
  const handleSubmit = async () => {
    // Validate form
    if (!feedbackText.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter your feedback',
        severity: 'error'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare feedback data
      const feedbackData = {
        type: feedbackType,
        message: feedbackText,
        email: email || undefined,
        screenshot: includeScreenshot ? screenshot : undefined,
        deviceInfo: Capacitor.isNativePlatform() ? {
          platform: Capacitor.getPlatform(),
          appVersion: '1.0.0', // This would be dynamically fetched
          deviceModel: 'Unknown', // This would be dynamically fetched
          osVersion: 'Unknown' // This would be dynamically fetched
        } : {
          platform: 'web',
          userAgent: navigator.userAgent
        }
      };
      
      // Send feedback to server
      // In a real app, this would be an actual API endpoint
      // await axios.post('/api/feedback', feedbackData);
      
      // For now, we'll just simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track event
      AnalyticsService.trackEvent('feedback_submitted', {
        type: feedbackType
      });
      
      // Trigger haptic feedback on native platforms
      if (Capacitor.isNativePlatform()) {
        PlatformUtils.hapticFeedback('success');
      }
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Thank you for your feedback!',
        severity: 'success'
      });
      
      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      
      // Show error message
      setSnackbar({
        open: true,
        message: 'Failed to submit feedback. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
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
    <>
      {/* Floating feedback button */}
      <Fab
        color="primary"
        aria-label="feedback"
        onClick={handleOpen}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000
        }}
      >
        <FeedbackIcon />
      </Fab>
      
      {/* Feedback dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send Feedback</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            We'd love to hear your thoughts on how we can improve Numira. Your feedback helps us make the app better for everyone.
          </DialogContentText>
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="feedback-type-label">Feedback Type</InputLabel>
            <Select
              labelId="feedback-type-label"
              id="feedback-type"
              value={feedbackType}
              onChange={handleFeedbackTypeChange}
              label="Feedback Type"
            >
              <MenuItem value="suggestion">Suggestion</MenuItem>
              <MenuItem value="bug">Bug Report</MenuItem>
              <MenuItem value="praise">Praise</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            autoFocus
            margin="normal"
            id="feedback"
            label="Your Feedback"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={feedbackText}
            onChange={handleFeedbackTextChange}
            placeholder={feedbackType === 'bug' 
              ? 'Please describe the issue you encountered and steps to reproduce it...' 
              : 'Share your thoughts with us...'}
          />
          
          <TextField
            margin="normal"
            id="email"
            label="Email (optional)"
            type="email"
            fullWidth
            value={email}
            onChange={handleEmailChange}
            placeholder="If you'd like us to follow up with you"
            helperText="We'll only use this to respond to your feedback"
          />
          
          {Capacitor.isNativePlatform() && (
            <FormControl fullWidth margin="normal">
              <Button
                variant="outlined"
                onClick={handleIncludeScreenshotToggle}
                color={includeScreenshot ? 'primary' : 'inherit'}
              >
                {includeScreenshot ? 'Remove Screenshot' : 'Include Screenshot'}
              </Button>
              
              {includeScreenshot && screenshot && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <img 
                    src={screenshot} 
                    alt="Screenshot" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: 200, 
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: theme.shape.borderRadius
                    }} 
                  />
                </Box>
              )}
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            color="primary" 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Feedback'}
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
    </>
  );
};

export default FeedbackButton;
