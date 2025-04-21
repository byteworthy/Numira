import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import Fingerprint2 from 'fingerprintjs2';

/**
 * Secure storage utility for handling sensitive user data
 * Uses encryption for sensitive data and device fingerprinting for additional security
 */
class SecureStorage {
  static encryptionKey = null;
  static deviceId = null;
  static initialized = false;

  /**
   * Initialize the secure storage
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      // Generate or retrieve device ID
      this.deviceId = await this.getDeviceId();
      
      // Generate or retrieve encryption key
      this.encryptionKey = await this.getEncryptionKey();
      
      this.initialized = true;
      console.log('Secure storage initialized');
    } catch (error) {
      console.error('Error initializing secure storage:', error);
    }
  }

  /**
   * Get or generate a device ID
   * @returns {Promise<string>} - Device ID
   */
  static async getDeviceId() {
    try {
      // Try to get existing device ID
      const { value } = await Preferences.get({ key: 'numira_device_id' });
      
      if (value) {
        return value;
      }
      
      // Generate a new device ID if none exists
      let deviceId;
      
      if (Capacitor.isNativePlatform()) {
        // For native platforms, use a UUID
        deviceId = uuidv4();
      } else {
        // For web, use fingerprinting
        const components = await Fingerprint2.getPromise();
        const values = components.map(component => component.value);
        deviceId = CryptoJS.SHA256(values.join('')).toString();
      }
      
      // Save the device ID
      await Preferences.set({
        key: 'numira_device_id',
        value: deviceId
      });
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback to a random UUID
      return uuidv4();
    }
  }

  /**
   * Get or generate an encryption key
   * @returns {Promise<string>} - Encryption key
   */
  static async getEncryptionKey() {
    try {
      // Try to get existing encryption key
      const { value } = await Preferences.get({ key: 'numira_encryption_key' });
      
      if (value) {
        return value;
      }
      
      // Generate a new encryption key if none exists
      const encryptionKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
      
      // Save the encryption key
      await Preferences.set({
        key: 'numira_encryption_key',
        value: encryptionKey
      });
      
      return encryptionKey;
    } catch (error) {
      console.error('Error getting encryption key:', error);
      // Fallback to a random key
      return CryptoJS.lib.WordArray.random(256 / 8).toString();
    }
  }

  /**
   * Encrypt data
   * @param {any} data - Data to encrypt
   * @returns {string} - Encrypted data
   */
  static encrypt(data) {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }
    
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(dataString, this.encryptionKey).toString();
  }

  /**
   * Decrypt data
   * @param {string} encryptedData - Encrypted data
   * @returns {any} - Decrypted data
   */
  static decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }
    
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      try {
        // Try to parse as JSON
        return JSON.parse(decryptedString);
      } catch (e) {
        // Return as string if not valid JSON
        return decryptedString;
      }
    } catch (error) {
      console.error('Error decrypting data:', error);
      return null;
    }
  }

  /**
   * Save data securely
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @param {boolean} encrypt - Whether to encrypt the data
   * @returns {Promise<void>}
   */
  static async setItem(key, data, encrypt = true) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const valueToStore = encrypt ? this.encrypt(data) : JSON.stringify(data);
      
      await Preferences.set({
        key,
        value: valueToStore
      });
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
    }
  }

  /**
   * Get data securely
   * @param {string} key - Storage key
   * @param {boolean} encrypted - Whether the data is encrypted
   * @returns {Promise<any>} - Retrieved data
   */
  static async getItem(key, encrypted = true) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const { value } = await Preferences.get({ key });
      
      if (!value) {
        return null;
      }
      
      if (encrypted) {
        return this.decrypt(value);
      } else {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove data
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  static async removeItem(key) {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
    }
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  static async clear() {
    try {
      await Preferences.clear();
      
      // Regenerate encryption key and device ID
      this.encryptionKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
      this.deviceId = uuidv4();
      
      // Save the new values
      await Preferences.set({
        key: 'numira_encryption_key',
        value: this.encryptionKey
      });
      
      await Preferences.set({
        key: 'numira_device_id',
        value: this.deviceId
      });
    } catch (error) {
      console.error('Error clearing secure storage:', error);
    }
  }

  /**
   * Store user credentials securely
   * @param {Object} credentials - User credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.token - Authentication token
   * @returns {Promise<void>}
   */
  static async storeUserCredentials(credentials) {
    await this.setItem('user_credentials', credentials, true);
  }

  /**
   * Get user credentials
   * @returns {Promise<Object|null>} - User credentials
   */
  static async getUserCredentials() {
    return await this.getItem('user_credentials', true);
  }

  /**
   * Clear user credentials
   * @returns {Promise<void>}
   */
  static async clearUserCredentials() {
    await this.removeItem('user_credentials');
  }

  /**
   * Store biometric authentication status
   * @param {boolean} enabled - Whether biometric authentication is enabled
   * @returns {Promise<void>}
   */
  static async setBiometricEnabled(enabled) {
    await this.setItem('biometric_enabled', enabled, false);
  }

  /**
   * Check if biometric authentication is enabled
   * @returns {Promise<boolean>} - Whether biometric authentication is enabled
   */
  static async isBiometricEnabled() {
    const enabled = await this.getItem('biometric_enabled', false);
    return enabled === true;
  }
}

export default SecureStorage;
