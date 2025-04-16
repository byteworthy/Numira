import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Plugins } from '@capacitor/core';

/**
 * Service for handling deep linking in the application
 */
class DeepLinkingService {
  static initialized = false;
  static listeners = [];
  static lastUrl = null;

  /**
   * Initialize deep linking
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      if (Capacitor.isNativePlatform()) {
        // Set up app URL open listener for native platforms
        App.addListener('appUrlOpen', ({ url }) => {
          this.handleDeepLink(url);
        });
        
        // Check if app was opened with URL
        const { value } = await Plugins.App.getLaunchUrl();
        if (value) {
          this.handleDeepLink(value);
        }
      } else {
        // For web, handle URL parameters
        this.handleWebDeepLink();
        
        // Listen for history changes
        window.addEventListener('popstate', () => {
          this.handleWebDeepLink();
        });
      }
      
      this.initialized = true;
      console.log('Deep linking service initialized');
    } catch (error) {
      console.error('Error initializing deep linking service:', error);
    }
  }

  /**
   * Handle a deep link
   * @param {string} url - Deep link URL
   */
  static handleDeepLink(url) {
    if (!url) return;
    
    this.lastUrl = url;
    console.log('Deep link received:', url);
    
    try {
      // Parse the URL
      const parsedUrl = new URL(url);
      
      // Extract the path and parameters
      const path = parsedUrl.pathname;
      const params = {};
      
      // Parse query parameters
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        params[key] = value;
      }
      
      // Create deep link object
      const deepLink = {
        url,
        path,
        params,
        scheme: parsedUrl.protocol.replace(':', '')
      };
      
      // Notify listeners
      this.notifyListeners(deepLink);
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  /**
   * Handle web deep linking (URL parameters)
   */
  static handleWebDeepLink() {
    const url = window.location.href;
    
    if (url === this.lastUrl) return;
    
    this.lastUrl = url;
    console.log('Web deep link:', url);
    
    try {
      // Parse the URL
      const parsedUrl = new URL(url);
      
      // Extract the path and parameters
      const path = parsedUrl.pathname;
      const params = {};
      
      // Parse query parameters
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        params[key] = value;
      }
      
      // Extract hash parameters
      if (parsedUrl.hash) {
        const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
        for (const [key, value] of hashParams.entries()) {
          params[key] = value;
        }
      }
      
      // Create deep link object
      const deepLink = {
        url,
        path,
        params,
        scheme: 'https'
      };
      
      // Notify listeners
      this.notifyListeners(deepLink);
    } catch (error) {
      console.error('Error handling web deep link:', error);
    }
  }

  /**
   * Notify listeners of a deep link
   * @param {Object} deepLink - Deep link object
   */
  static notifyListeners(deepLink) {
    this.listeners.forEach(listener => {
      try {
        listener(deepLink);
      } catch (error) {
        console.error('Error in deep link listener:', error);
      }
    });
  }

  /**
   * Add a deep link listener
   * @param {Function} listener - Deep link listener
   * @returns {Function} - Function to remove the listener
   */
  static addListener(listener) {
    this.listeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Create a deep link
   * @param {Object} options - Deep link options
   * @param {string} options.path - Deep link path
   * @param {Object} options.params - Deep link parameters
   * @returns {string} - Deep link URL
   */
  static createDeepLink(options) {
    const { path, params = {} } = options;
    
    try {
      // Create URL parameters
      const searchParams = new URLSearchParams();
      
      // Add parameters
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, value);
      });
      
      // Create URL
      if (Capacitor.isNativePlatform()) {
        // For native platforms, use custom scheme
        return `numira://${path}?${searchParams.toString()}`;
      } else {
        // For web, use regular URL
        const baseUrl = window.location.origin;
        return `${baseUrl}${path}?${searchParams.toString()}`;
      }
    } catch (error) {
      console.error('Error creating deep link:', error);
      return '';
    }
  }

  /**
   * Open a deep link
   * @param {Object} options - Deep link options
   * @param {string} options.path - Deep link path
   * @param {Object} options.params - Deep link parameters
   * @returns {Promise<void>}
   */
  static async openDeepLink(options) {
    const deepLink = this.createDeepLink(options);
    
    if (!deepLink) return;
    
    try {
      if (Capacitor.isNativePlatform()) {
        // For native platforms, use App plugin
        await App.openUrl({ url: deepLink });
      } else {
        // For web, use window.location
        window.location.href = deepLink;
      }
    } catch (error) {
      console.error('Error opening deep link:', error);
    }
  }

  /**
   * Parse a conversation deep link
   * @param {Object} deepLink - Deep link object
   * @returns {Object|null} - Conversation object or null if not a conversation deep link
   */
  static parseConversationDeepLink(deepLink) {
    if (!deepLink || !deepLink.path) return null;
    
    // Check if path matches conversation pattern
    const conversationMatch = deepLink.path.match(/\/conversation\/([^/]+)/);
    
    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      
      return {
        type: 'conversation',
        conversationId,
        ...deepLink.params
      };
    }
    
    return null;
  }

  /**
   * Parse a persona deep link
   * @param {Object} deepLink - Deep link object
   * @returns {Object|null} - Persona object or null if not a persona deep link
   */
  static parsePersonaDeepLink(deepLink) {
    if (!deepLink || !deepLink.path) return null;
    
    // Check if path matches persona pattern
    const personaMatch = deepLink.path.match(/\/persona\/([^/]+)/);
    
    if (personaMatch) {
      const personaId = personaMatch[1];
      
      return {
        type: 'persona',
        personaId,
        ...deepLink.params
      };
    }
    
    return null;
  }

  /**
   * Parse a profile deep link
   * @param {Object} deepLink - Deep link object
   * @returns {Object|null} - Profile object or null if not a profile deep link
   */
  static parseProfileDeepLink(deepLink) {
    if (!deepLink || !deepLink.path) return null;
    
    // Check if path matches profile pattern
    if (deepLink.path === '/profile') {
      return {
        type: 'profile',
        ...deepLink.params
      };
    }
    
    return null;
  }

  /**
   * Parse a settings deep link
   * @param {Object} deepLink - Deep link object
   * @returns {Object|null} - Settings object or null if not a settings deep link
   */
  static parseSettingsDeepLink(deepLink) {
    if (!deepLink || !deepLink.path) return null;
    
    // Check if path matches settings pattern
    if (deepLink.path === '/settings') {
      return {
        type: 'settings',
        ...deepLink.params
      };
    }
    
    return null;
  }

  /**
   * Parse a deep link
   * @param {Object} deepLink - Deep link object
   * @returns {Object|null} - Parsed deep link object or null if not a recognized deep link
   */
  static parseDeepLink(deepLink) {
    if (!deepLink) return null;
    
    // Try to parse as conversation deep link
    const conversation = this.parseConversationDeepLink(deepLink);
    if (conversation) return conversation;
    
    // Try to parse as persona deep link
    const persona = this.parsePersonaDeepLink(deepLink);
    if (persona) return persona;
    
    // Try to parse as profile deep link
    const profile = this.parseProfileDeepLink(deepLink);
    if (profile) return profile;
    
    // Try to parse as settings deep link
    const settings = this.parseSettingsDeepLink(deepLink);
    if (settings) return settings;
    
    // Not a recognized deep link
    return null;
  }
}

export default DeepLinkingService;
