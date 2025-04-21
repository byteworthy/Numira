import { Capacitor } from '@capacitor/core';
import SecureStorage from './secureStorage';

/**
 * Analytics service for tracking user engagement across web and mobile platforms
 */
class AnalyticsService {
  static initialized = false;
  static userId = null;
  static sessionId = null;
  static analyticsProvider = null;
  static isEnabled = true;

  /**
   * Initialize the analytics service
   * @param {string} userId - User ID for tracking
   * @returns {Promise<void>}
   */
  static async initialize(userId) {
    if (this.initialized) return;

    try {
      // Check if analytics is enabled
      const analyticsEnabled = await this.isAnalyticsEnabled();
      this.isEnabled = analyticsEnabled;

      if (!this.isEnabled) {
        console.log('Analytics is disabled by user preference');
        return;
      }

      // Set user ID
      this.userId = userId;

      // Generate session ID
      this.sessionId = this.generateSessionId();

      // Initialize the appropriate analytics provider
      if (Capacitor.isNativePlatform()) {
        await this.initializeNative();
      } else {
        await this.initializeWeb();
      }

      this.initialized = true;
      console.log('Analytics service initialized');
    } catch (error) {
      console.error('Error initializing analytics service:', error);
    }
  }

  /**
   * Initialize analytics for native platforms
   * @returns {Promise<void>}
   */
  static async initializeNative() {
    try {
      if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
        // Import Firebase Analytics
        const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
        
        // Configure Firebase Analytics
        await FirebaseAnalytics.initializeFirebase({
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID,
          measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
        });
        
        // Enable collection
        await FirebaseAnalytics.setCollectionEnabled({ enabled: true });
        
        // Set user ID
        if (this.userId) {
          await FirebaseAnalytics.setUserId({ userId: this.userId });
        }
        
        // Set session ID
        await FirebaseAnalytics.setUserProperty({
          name: 'session_id',
          value: this.sessionId
        });
        
        // Set platform
        await FirebaseAnalytics.setUserProperty({
          name: 'platform',
          value: Capacitor.getPlatform()
        });
        
        this.analyticsProvider = FirebaseAnalytics;
      }
    } catch (error) {
      console.error('Error initializing native analytics:', error);
    }
  }

  /**
   * Initialize analytics for web
   * @returns {Promise<void>}
   */
  static async initializeWeb() {
    try {
      // For web, we'll use Google Analytics
      if (!window.gtag) {
        // Load Google Analytics script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.REACT_APP_GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);
        
        // Initialize Google Analytics
        window.dataLayer = window.dataLayer || [];
        window.gtag = function() {
          window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());
        window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID);
      }
      
      // Set user ID
      if (this.userId) {
        window.gtag('set', { 'user_id': this.userId });
      }
      
      // Set session ID
      window.gtag('set', { 'session_id': this.sessionId });
      
      // Set platform
      window.gtag('set', { 'platform': 'web' });
      
      this.analyticsProvider = window.gtag;
    } catch (error) {
      console.error('Error initializing web analytics:', error);
    }
  }

  /**
   * Generate a session ID
   * @returns {string} - Session ID
   */
  static generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Track a screen view
   * @param {string} screenName - Name of the screen
   * @param {Object} properties - Additional properties
   * @returns {Promise<void>}
   */
  static async trackScreen(screenName, properties = {}) {
    if (!this.isEnabled) return;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (Capacitor.isNativePlatform() && this.analyticsProvider) {
        await this.analyticsProvider.setScreenName({
          screenName,
          parameters: properties
        });
      } else if (window.gtag) {
        window.gtag('event', 'screen_view', {
          screen_name: screenName,
          ...properties
        });
      }

      console.log(`Tracked screen: ${screenName}`);
    } catch (error) {
      console.error('Error tracking screen:', error);
    }
  }

  /**
   * Track an event
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Additional properties
   * @returns {Promise<void>}
   */
  static async trackEvent(eventName, properties = {}) {
    if (!this.isEnabled) return;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (Capacitor.isNativePlatform() && this.analyticsProvider) {
        await this.analyticsProvider.logEvent({
          name: eventName,
          parameters: properties
        });
      } else if (window.gtag) {
        window.gtag('event', eventName, properties);
      }

      console.log(`Tracked event: ${eventName}`);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  /**
   * Track user properties
   * @param {Object} properties - User properties
   * @returns {Promise<void>}
   */
  static async trackUserProperties(properties) {
    if (!this.isEnabled) return;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (Capacitor.isNativePlatform() && this.analyticsProvider) {
        // Set each property individually
        for (const [key, value] of Object.entries(properties)) {
          await this.analyticsProvider.setUserProperty({
            name: key,
            value: String(value)
          });
        }
      } else if (window.gtag) {
        window.gtag('set', 'user_properties', properties);
      }

      console.log('Tracked user properties');
    } catch (error) {
      console.error('Error tracking user properties:', error);
    }
  }

  /**
   * Track a purchase
   * @param {Object} purchase - Purchase details
   * @param {string} purchase.productId - Product ID
   * @param {number} purchase.price - Price
   * @param {string} purchase.currency - Currency
   * @returns {Promise<void>}
   */
  static async trackPurchase(purchase) {
    if (!this.isEnabled) return;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (Capacitor.isNativePlatform() && this.analyticsProvider) {
        await this.analyticsProvider.logEvent({
          name: 'purchase',
          parameters: {
            items: [{
              item_id: purchase.productId,
              item_name: purchase.productId,
              price: purchase.price,
              currency: purchase.currency
            }],
            value: purchase.price,
            currency: purchase.currency
          }
        });
      } else if (window.gtag) {
        window.gtag('event', 'purchase', {
          items: [{
            item_id: purchase.productId,
            item_name: purchase.productId,
            price: purchase.price,
            currency: purchase.currency
          }],
          value: purchase.price,
          currency: purchase.currency
        });
      }

      console.log(`Tracked purchase: ${purchase.productId}`);
    } catch (error) {
      console.error('Error tracking purchase:', error);
    }
  }

  /**
   * Enable or disable analytics
   * @param {boolean} enabled - Whether analytics should be enabled
   * @returns {Promise<void>}
   */
  static async setAnalyticsEnabled(enabled) {
    try {
      this.isEnabled = enabled;
      
      // Store the preference
      await SecureStorage.setItem('analytics_enabled', enabled, false);
      
      if (Capacitor.isNativePlatform() && this.analyticsProvider) {
        await this.analyticsProvider.setCollectionEnabled({ enabled });
      }
      
      console.log(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error setting analytics enabled:', error);
    }
  }

  /**
   * Check if analytics is enabled
   * @returns {Promise<boolean>} - Whether analytics is enabled
   */
  static async isAnalyticsEnabled() {
    try {
      const enabled = await SecureStorage.getItem('analytics_enabled', false);
      return enabled !== false; // Default to true if not set
    } catch (error) {
      console.error('Error checking if analytics is enabled:', error);
      return true; // Default to true
    }
  }
}

export default AnalyticsService;
