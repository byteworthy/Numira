import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import OnboardingTutorial from './OnboardingTutorial';
import SecureStorage from '../../utils/secureStorage';

/**
 * Component to manage the onboarding experience
 * This component checks if the user is new and shows the onboarding tutorial if needed
 */
const OnboardingManager = () => {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);

  // Check if the tutorial should be shown
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!isAuthenticated || !user) {
        setTutorialChecked(true);
        return;
      }

      try {
        // Check if the tutorial has been completed
        const tutorialCompleted = await SecureStorage.getItem('tutorial_completed', false);
        
        // If the tutorial has not been completed, show it
        if (tutorialCompleted === null || tutorialCompleted === false) {
          setShowTutorial(true);
        }
        
        setTutorialChecked(true);
      } catch (error) {
        console.error('Error checking tutorial status:', error);
        setTutorialChecked(true);
      }
    };

    checkTutorialStatus();
  }, [isAuthenticated, user]);

  // Handle tutorial close
  const handleTutorialClose = () => {
    setShowTutorial(false);
  };

  // Only render the tutorial if the tutorial status has been checked
  if (!tutorialChecked) {
    return null;
  }

  return (
    <OnboardingTutorial
      open={showTutorial}
      onClose={handleTutorialClose}
    />
  );
};

export default OnboardingManager;
