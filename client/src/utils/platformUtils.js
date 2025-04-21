import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Utility for platform-specific UI adjustments and behaviors
 */
class PlatformUtils {
  static isNative = Capacitor.isNativePlatform();
  static platform = Capacitor.getPlatform();
  static isIOS = PlatformUtils.platform === 'ios';
  static isAndroid = PlatformUtils.platform === 'android';
  static initialized = false;
  static safeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  static keyboardHeight = 0;
  static keyboardVisible = false;
  static backButtonListeners = [];

  /**
   * Initialize platform-specific behaviors
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized || !this.isNative) return;

    try {
      // Set up status bar
      await this.setupStatusBar();
      
      // Set up back button handling
      await this.setupBackButton();
      
      // Set up keyboard handling
      await this.setupKeyboard();
      
      // Get safe area insets
      await this.getSafeAreaInsets();
      
      this.initialized = true;
      console.log('Platform utils initialized');
    } catch (error) {
      console.error('Error initializing platform utils:', error);
    }
  }

  /**
   * Set up status bar
   * @returns {Promise<void>}
   */
  static async setupStatusBar() {
    if (!this.isNative) return;

    try {
      if (this.isIOS) {
        // For iOS, use light content (white text) on dark background
        await StatusBar.setStyle({ style: StatusBar.Style.Light });
        await StatusBar.setBackgroundColor({ color: '#8A6FDF' });
      } else if (this.isAndroid) {
        // For Android, set the status bar color and style
        await StatusBar.setBackgroundColor({ color: '#8A6FDF' });
        await StatusBar.setStyle({ style: StatusBar.Style.Light });
        await StatusBar.setOverlaysWebView({ overlay: false });
      }
    } catch (error) {
      console.error('Error setting up status bar:', error);
    }
  }

  /**
   * Set up back button handling
   * @returns {Promise<void>}
   */
  static async setupBackButton() {
    if (!this.isNative || !this.isAndroid) return;

    try {
      // Add back button listener
      App.addListener('backButton', ({ canGoBack }) => {
        // If there are registered listeners, call the most recent one
        if (this.backButtonListeners.length > 0) {
          const lastListener = this.backButtonListeners[this.backButtonListeners.length - 1];
          lastListener();
          return;
        }
        
        // Otherwise, use default behavior
        if (canGoBack) {
          window.history.back();
        } else {
          // Ask if user wants to exit app
          if (window.confirm('Do you want to exit the app?')) {
            App.exitApp();
          }
        }
      });
    } catch (error) {
      console.error('Error setting up back button:', error);
    }
  }

  /**
   * Set up keyboard handling
   * @returns {Promise<void>}
   */
  static async setupKeyboard() {
    if (!this.isNative) return;

    try {
      // Configure keyboard behavior
      await Keyboard.setResizeMode({ mode: Keyboard.ResizeMode.Body });
      await Keyboard.setScroll({ isDisabled: false });
      
      // Add keyboard listeners
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.keyboardHeight = info.keyboardHeight;
        this.keyboardVisible = true;
        document.body.classList.add('keyboard-visible');
        
        // Add bottom padding to body to prevent content from being hidden
        document.body.style.paddingBottom = `${info.keyboardHeight}px`;
      });
      
      Keyboard.addListener('keyboardWillHide', () => {
        this.keyboardHeight = 0;
        this.keyboardVisible = false;
        document.body.classList.remove('keyboard-visible');
        
        // Remove bottom padding
        document.body.style.paddingBottom = '0px';
      });
    } catch (error) {
      console.error('Error setting up keyboard:', error);
    }
  }

  /**
   * Get safe area insets
   * @returns {Promise<void>}
   */
  static async getSafeAreaInsets() {
    if (!this.isNative) return;

    try {
      // For iOS, get safe area insets from CSS variables
      if (this.isIOS) {
        // Wait for DOM to be ready
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            window.addEventListener('load', resolve);
          });
        }
        
        // Get safe area insets from CSS variables
        const computedStyle = getComputedStyle(document.documentElement);
        
        this.safeAreaInsets = {
          top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
          right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
          bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
          left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10)
        };
        
        // Set CSS variables for safe area insets
        document.documentElement.style.setProperty('--safe-area-top', `${this.safeAreaInsets.top}px`);
        document.documentElement.style.setProperty('--safe-area-right', `${this.safeAreaInsets.right}px`);
        document.documentElement.style.setProperty('--safe-area-bottom', `${this.safeAreaInsets.bottom}px`);
        document.documentElement.style.setProperty('--safe-area-left', `${this.safeAreaInsets.left}px`);
      }
    } catch (error) {
      console.error('Error getting safe area insets:', error);
    }
  }

  /**
   * Register a back button listener
   * @param {Function} listener - Back button listener
   * @returns {Function} - Function to remove the listener
   */
  static registerBackButtonListener(listener) {
    if (!this.isNative || !this.isAndroid) return () => {};

    this.backButtonListeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      const index = this.backButtonListeners.indexOf(listener);
      if (index !== -1) {
        this.backButtonListeners.splice(index, 1);
      }
    };
  }

  /**
   * Show the keyboard
   * @returns {Promise<void>}
   */
  static async showKeyboard() {
    if (!this.isNative) return;

    try {
      await Keyboard.show();
    } catch (error) {
      console.error('Error showing keyboard:', error);
    }
  }

  /**
   * Hide the keyboard
   * @returns {Promise<void>}
   */
  static async hideKeyboard() {
    if (!this.isNative) return;

    try {
      await Keyboard.hide();
    } catch (error) {
      console.error('Error hiding keyboard:', error);
    }
  }

  /**
   * Trigger haptic feedback
   * @param {string} type - Type of haptic feedback (light, medium, heavy, success, warning, error)
   * @returns {Promise<void>}
   */
  static async hapticFeedback(type = 'light') {
    if (!this.isNative) return;

    try {
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: 'SUCCESS' });
          break;
        case 'warning':
          await Haptics.notification({ type: 'WARNING' });
          break;
        case 'error':
          await Haptics.notification({ type: 'ERROR' });
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  }

  /**
   * Get platform-specific styles
   * @param {Object} baseStyles - Base styles
   * @param {Object} iosStyles - iOS-specific styles
   * @param {Object} androidStyles - Android-specific styles
   * @returns {Object} - Combined styles
   */
  static getPlatformStyles(baseStyles = {}, iosStyles = {}, androidStyles = {}) {
    if (!this.isNative) return baseStyles;

    if (this.isIOS) {
      return { ...baseStyles, ...iosStyles };
    } else if (this.isAndroid) {
      return { ...baseStyles, ...androidStyles };
    }

    return baseStyles;
  }

  /**
   * Apply safe area insets to a style object
   * @param {Object} styles - Style object
   * @returns {Object} - Style object with safe area insets
   */
  static applySafeAreaInsets(styles = {}) {
    if (!this.isNative || !this.isIOS) return styles;

    return {
      ...styles,
      paddingTop: `calc(${styles.paddingTop || '0px'} + var(--safe-area-top, 0px))`,
      paddingRight: `calc(${styles.paddingRight || '0px'} + var(--safe-area-right, 0px))`,
      paddingBottom: `calc(${styles.paddingBottom || '0px'} + var(--safe-area-bottom, 0px))`,
      paddingLeft: `calc(${styles.paddingLeft || '0px'} + var(--safe-area-left, 0px))`,
    };
  }

  /**
   * Check if the device is in landscape orientation
   * @returns {boolean} - Whether the device is in landscape orientation
   */
  static isLandscape() {
    return window.innerWidth > window.innerHeight;
  }

  /**
   * Check if the device is a tablet
   * @returns {boolean} - Whether the device is a tablet
   */
  static isTablet() {
    return window.innerWidth >= 768 || window.innerHeight >= 768;
  }

  /**
   * Get the appropriate font size for the platform
   * @param {number} baseSize - Base font size
   * @returns {number} - Platform-specific font size
   */
  static getFontSize(baseSize) {
    if (!this.isNative) return baseSize;

    if (this.isIOS) {
      return baseSize;
    } else if (this.isAndroid) {
      // Android typically needs slightly larger fonts
      return baseSize * 1.1;
    }

    return baseSize;
  }

  /**
   * Get the appropriate icon size for the platform
   * @param {number} baseSize - Base icon size
   * @returns {number} - Platform-specific icon size
   */
  static getIconSize(baseSize) {
    if (!this.isNative) return baseSize;

    if (this.isIOS) {
      return baseSize;
    } else if (this.isAndroid) {
      // Android typically uses slightly larger icons
      return baseSize * 1.2;
    }

    return baseSize;
  }

  /**
   * Get the appropriate touch target size for the platform
   * @param {number} baseSize - Base touch target size
   * @returns {number} - Platform-specific touch target size
   */
  static getTouchTargetSize(baseSize) {
    // Ensure minimum touch target size of 44x44 pixels
    const minSize = 44;
    
    if (baseSize < minSize) {
      baseSize = minSize;
    }
    
    if (!this.isNative) return baseSize;
    
    if (this.isIOS) {
      return baseSize;
    } else if (this.isAndroid) {
      // Android typically uses slightly larger touch targets
      return baseSize * 1.1;
    }
    
    return baseSize;
  }
}

export default PlatformUtils;
