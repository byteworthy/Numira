import { Capacitor } from '@capacitor/core';
import SecureStorage from './secureStorage';

/**
 * Utility for handling biometric authentication (Face ID, Touch ID, Fingerprint)
 */
class BiometricAuth {
  static isAvailable = null;

  /**
   * Check if biometric authentication is available on the device
   * @returns {Promise<boolean>} - Whether biometric authentication is available
   */
  static async checkAvailability() {
    if (!Capacitor.isNativePlatform()) {
      this.isAvailable = false;
      return false;
    }

    try {
      // Dynamically import NativeBiometric to avoid issues on web
      const { NativeBiometric, BiometricOptions } = await import('@capawesome/capacitor-biometric-auth');
      
      const result = await NativeBiometric.isAvailable();
      this.isAvailable = result.isAvailable;
      
      return this.isAvailable;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Verify biometric identity
   * @param {Object} options - Authentication options
   * @param {string} options.title - Title for the authentication prompt
   * @param {string} options.subtitle - Subtitle for the authentication prompt
   * @returns {Promise<boolean>} - Whether authentication was successful
   */
  static async authenticate(options = {}) {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    // Check if biometric is available
    if (this.isAvailable === null) {
      await this.checkAvailability();
    }

    if (!this.isAvailable) {
      return false;
    }

    try {
      // Dynamically import NativeBiometric to avoid issues on web
      const { NativeBiometric, BiometricOptions } = await import('@capawesome/capacitor-biometric-auth');
      
      const result = await NativeBiometric.verify({
        reason: options.title || 'Authenticate to access your account',
        title: options.title || 'Biometric Authentication',
        subtitle: options.subtitle || 'Use your biometric data to verify your identity',
        cancelTitle: 'Cancel',
        fallbackTitle: 'Use Password',
        useFallback: true
      });
      
      return result.verified;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  }

  /**
   * Set up biometric authentication for the user
   * @param {Object} credentials - User credentials to store
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @returns {Promise<boolean>} - Whether setup was successful
   */
  static async setupBiometric(credentials) {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    // Check if biometric is available
    if (this.isAvailable === null) {
      await this.checkAvailability();
    }

    if (!this.isAvailable) {
      return false;
    }

    try {
      // Dynamically import NativeBiometric to avoid issues on web
      const { NativeBiometric, BiometricOptions } = await import('@capawesome/capacitor-biometric-auth');
      
      // First verify the user's biometric identity
      const verifyResult = await NativeBiometric.verify({
        reason: 'Set up biometric authentication',
        title: 'Biometric Setup',
        subtitle: 'Verify your identity to enable biometric login',
        cancelTitle: 'Cancel',
        fallbackTitle: 'Use Password',
        useFallback: true
      });
      
      if (!verifyResult.verified) {
        return false;
      }
      
      // Store credentials securely
      await NativeBiometric.setCredentials({
        username: credentials.username,
        password: credentials.password,
        server: 'numira.app'
      });
      
      // Mark biometric as enabled in secure storage
      await SecureStorage.setBiometricEnabled(true);
      
      return true;
    } catch (error) {
      console.error('Error setting up biometric authentication:', error);
      return false;
    }
  }

  /**
   * Get stored credentials using biometric authentication
   * @returns {Promise<Object|null>} - Stored credentials or null if authentication failed
   */
  static async getCredentials() {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    // Check if biometric is available and enabled
    if (this.isAvailable === null) {
      await this.checkAvailability();
    }

    if (!this.isAvailable) {
      return null;
    }

    const biometricEnabled = await SecureStorage.isBiometricEnabled();
    if (!biometricEnabled) {
      return null;
    }

    try {
      // Dynamically import NativeBiometric to avoid issues on web
      const { NativeBiometric, BiometricOptions } = await import('@capawesome/capacitor-biometric-auth');
      
      // Verify the user's biometric identity
      const verifyResult = await NativeBiometric.verify({
        reason: 'Access your account',
        title: 'Biometric Authentication',
        subtitle: 'Use your biometric data to sign in',
        cancelTitle: 'Cancel',
        fallbackTitle: 'Use Password',
        useFallback: true
      });
      
      if (!verifyResult.verified) {
        return null;
      }
      
      // Get stored credentials
      const credentials = await NativeBiometric.getCredentials({
        server: 'numira.app'
      });
      
      return credentials;
    } catch (error) {
      console.error('Error getting credentials with biometric authentication:', error);
      return null;
    }
  }

  /**
   * Delete stored credentials
   * @returns {Promise<boolean>} - Whether deletion was successful
   */
  static async deleteCredentials() {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      // Dynamically import NativeBiometric to avoid issues on web
      const { NativeBiometric, BiometricOptions } = await import('@capawesome/capacitor-biometric-auth');
      
      await NativeBiometric.deleteCredentials({
        server: 'numira.app'
      });
      
      // Mark biometric as disabled in secure storage
      await SecureStorage.setBiometricEnabled(false);
      
      return true;
    } catch (error) {
      console.error('Error deleting biometric credentials:', error);
      return false;
    }
  }
}

export default BiometricAuth;
