import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MobileStepper,
  Paper,
  Typography,
  useTheme,
  Zoom,
  Fade
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Psychology as PsychologyIcon,
  Chat as ChatIcon,
  Lightbulb as LightbulbIcon,
  Person as PersonIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';
import SecureStorage from '../../utils/secureStorage';
import AnalyticsService from '../../utils/analyticsService';
import PlatformUtils from '../../utils/platformUtils';

const OnboardingTutorial = ({ open, onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(true);
  const [animationDirection, setAnimationDirection] = useState('left');

  // Define tutorial steps
  const steps = [
    {
      title: 'Welcome to Numira',
      description: 'Your AI-powered mental clarity companion. Let\'s take a quick tour to help you get started.',
      icon: <PsychologyIcon sx={{ fontSize: 80, color: theme.palette.primary.main }} />,
      action: null
    },
    {
      title: 'Choose Your Companion',
      description: 'Select between different AI personas to match your mood and needs. Each persona has a unique approach to help you process your thoughts.',
      icon: <PersonIcon sx={{ fontSize: 80, color: theme.palette.primary.main }} />,
      action: {
        label: 'See Personas',
        handler: () => navigate('/personas')
      }
    },
    {
      title: 'Start a Conversation',
      description: 'Share your thoughts, feelings, and experiences. Numira will help you reflect and gain clarity through thoughtful responses.',
      icon: <ChatIcon sx={{ fontSize: 80, color: theme.palette.primary.main }} />,
      action: null
    },
    {
      title: 'Discover Insights',
      description: 'After conversations, Numira can generate insights to help you recognize patterns and gain deeper understanding of your thoughts.',
      icon: <LightbulbIcon sx={{ fontSize: 80, color: theme.palette.primary.main }} />,
      action: null
    },
    {
      title: 'Customize Your Experience',
      description: 'Visit Settings to personalize Numira with dark mode, notification preferences, and privacy options.',
      icon: <SettingsIcon sx={{ fontSize: 80, color: theme.palette.primary.main }} />,
      action: {
        label: 'Go to Settings',
        handler: () => navigate('/settings')
      }
    }
  ];

  // Handle next step
  const handleNext = () => {
    setAnimationDirection('left');
    
    // If last step, close the tutorial
    if (activeStep === steps.length - 1) {
      handleCompleteTutorial();
      return;
    }
    
    // Track step progress
    AnalyticsService.trackEvent('onboarding_next_step', {
      step: activeStep + 1
    });
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    
    // Hide skip button on last step
    if (activeStep === steps.length - 2) {
      setShowSkipButton(false);
    }
  };

  // Handle back step
  const handleBack = () => {
    setAnimationDirection('right');
    
    // Track step progress
    AnalyticsService.trackEvent('onboarding_previous_step', {
      step: activeStep - 1
    });
    
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    
    // Show skip button if going back from last step
    if (activeStep === steps.length - 1) {
      setShowSkipButton(true);
    }
  };

  // Handle skip tutorial
  const handleSkipTutorial = async () => {
    // Track skip event
    AnalyticsService.trackEvent('onboarding_skipped', {
      step: activeStep
    });
    
    // Mark tutorial as completed
    await markTutorialAsCompleted();
    
    // Close the tutorial
    onClose();
  };

  // Handle complete tutorial
  const handleCompleteTutorial = async () => {
    // Track completion event
    AnalyticsService.trackEvent('onboarding_completed');
    
    // Mark tutorial as completed
    await markTutorialAsCompleted();
    
    // Trigger haptic feedback on native platforms
    if (Capacitor.isNativePlatform()) {
      PlatformUtils.hapticFeedback('success');
    }
    
    // Close the tutorial
    onClose();
  };

  // Mark tutorial as completed
  const markTutorialAsCompleted = async () => {
    try {
      await SecureStorage.setItem('tutorial_completed', true, false);
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
  };

  // Handle action button click
  const handleActionClick = (action) => {
    // Track action click
    AnalyticsService.trackEvent('onboarding_action_clicked', {
      step: activeStep,
      action: steps[activeStep].title
    });
    
    // Close the tutorial
    onClose();
    
    // Execute the action
    action();
  };

  // Track tutorial open
  useEffect(() => {
    if (open) {
      AnalyticsService.trackEvent('onboarding_started');
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={handleSkipTutorial}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: theme.palette.background.default
      }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {steps[activeStep].title}
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={handleSkipTutorial}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ 
        p: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        bgcolor: theme.palette.background.default
      }}>
        <Fade
          in={true}
          timeout={500}
          style={{ 
            transitionDelay: '100ms',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Box>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                <Box>
                  {steps[activeStep].icon}
                </Box>
              </Zoom>
            </Box>
            
            <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
              {steps[activeStep].description}
            </Typography>
            
            {steps[activeStep].action && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleActionClick(steps[activeStep].action.handler)}
                sx={{ mt: 2 }}
              >
                {steps[activeStep].action.label}
              </Button>
            )}
          </Box>
        </Fade>
      </DialogContent>
      
      <MobileStepper
        variant="dots"
        steps={steps.length}
        position="static"
        activeStep={activeStep}
        sx={{ 
          bgcolor: theme.palette.background.default,
          '& .MuiMobileStepper-dot': {
            mx: 0.5
          },
          '& .MuiMobileStepper-dotActive': {
            bgcolor: theme.palette.primary.main
          }
        }}
        nextButton={
          <Button 
            size="small" 
            onClick={handleNext}
            color="primary"
          >
            {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            <KeyboardArrowRight />
          </Button>
        }
        backButton={
          <Button 
            size="small" 
            onClick={handleBack} 
            disabled={activeStep === 0}
            color="primary"
          >
            <KeyboardArrowLeft />
            Back
          </Button>
        }
      />
      
      {showSkipButton && activeStep < steps.length - 1 && (
        <DialogActions sx={{ bgcolor: theme.palette.background.default, justifyContent: 'center', pb: 2 }}>
          <Button onClick={handleSkipTutorial} color="inherit" size="small">
            Skip Tutorial
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default OnboardingTutorial;
