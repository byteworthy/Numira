import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import OfflineStorage from './offlineStorage';

/**
 * Utility for handling AI responses over potentially unreliable mobile networks
 */
class AINetworkHandler {
  static initialized = false;
  static networkStatus = { connected: true, connectionType: 'unknown' };
  static pendingRequests = [];
  static retryTimeouts = {};
  static maxRetries = 3;
  static retryDelayMs = 2000; // Start with 2 seconds
  static requestTimeoutMs = 15000; // 15 seconds
  static lowBandwidthMode = false;
  static compressionEnabled = true;

  /**
   * Initialize the AI network handler
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      // Set up network status monitoring
      if (Capacitor.isNativePlatform()) {
        // Get current network status
        const status = await Network.getStatus();
        this.networkStatus = status;
        
        // Listen for network status changes
        Network.addListener('networkStatusChange', (status) => {
          const wasConnected = this.networkStatus.connected;
          this.networkStatus = status;
          
          // If we just got connected, process pending requests
          if (!wasConnected && status.connected) {
            this.processPendingRequests();
          }
          
          // Adjust settings based on connection type
          this.adjustSettingsForConnectionType(status.connectionType);
        });
        
        // Initial adjustment based on connection type
        this.adjustSettingsForConnectionType(this.networkStatus.connectionType);
      }
      
      // Create axios instance with interceptors
      this.axiosInstance = axios.create({
        timeout: this.requestTimeoutMs,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Add request interceptor
      this.axiosInstance.interceptors.request.use(
        (config) => {
          // Add compression header if enabled
          if (this.compressionEnabled) {
            config.headers['Accept-Encoding'] = 'gzip, deflate';
          }
          
          // Add low bandwidth mode header if enabled
          if (this.lowBandwidthMode) {
            config.headers['X-Low-Bandwidth-Mode'] = 'true';
          }
          
          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );
      
      // Add response interceptor
      this.axiosInstance.interceptors.response.use(
        (response) => {
          return response;
        },
        (error) => {
          // Handle network errors
          if (error.message === 'Network Error' || !this.networkStatus.connected) {
            // Store the request for later retry
            const request = error.config;
            
            // Only store if it's not already a retry
            if (!request._retry) {
              this.addPendingRequest(request);
            }
            
            return Promise.reject({
              ...error,
              isNetworkError: true,
              pendingRequestId: request._pendingRequestId
            });
          }
          
          // Handle timeout errors
          if (error.code === 'ECONNABORTED') {
            const request = error.config;
            
            // If we haven't reached max retries, retry with increased timeout
            if (!request._retryCount || request._retryCount < this.maxRetries) {
              request._retryCount = (request._retryCount || 0) + 1;
              request.timeout = this.requestTimeoutMs * 1.5; // Increase timeout
              
              // Retry after delay
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve(this.axiosInstance(request));
                }, this.getRetryDelay(request._retryCount));
              });
            }
          }
          
          return Promise.reject(error);
        }
      );
      
      this.initialized = true;
      console.log('AI network handler initialized');
    } catch (error) {
      console.error('Error initializing AI network handler:', error);
    }
  }

  /**
   * Adjust settings based on connection type
   * @param {string} connectionType - Connection type
   */
  static adjustSettingsForConnectionType(connectionType) {
    switch (connectionType) {
      case 'wifi':
        this.lowBandwidthMode = false;
        this.compressionEnabled = true;
        this.requestTimeoutMs = 15000; // 15 seconds
        break;
      case 'cellular':
        // Check connection quality (simplified)
        if (navigator.connection && navigator.connection.downlink) {
          const downlink = navigator.connection.downlink; // Mbps
          
          if (downlink < 1) {
            // Very slow connection
            this.lowBandwidthMode = true;
            this.compressionEnabled = true;
            this.requestTimeoutMs = 30000; // 30 seconds
          } else if (downlink < 5) {
            // Medium connection
            this.lowBandwidthMode = true;
            this.compressionEnabled = true;
            this.requestTimeoutMs = 20000; // 20 seconds
          } else {
            // Fast connection
            this.lowBandwidthMode = false;
            this.compressionEnabled = true;
            this.requestTimeoutMs = 15000; // 15 seconds
          }
        } else {
          // Default to low bandwidth mode for cellular
          this.lowBandwidthMode = true;
          this.compressionEnabled = true;
          this.requestTimeoutMs = 20000; // 20 seconds
        }
        break;
      case 'none':
        // Offline mode
        this.lowBandwidthMode = true;
        this.compressionEnabled = true;
        this.requestTimeoutMs = 30000; // 30 seconds
        break;
      default:
        // Unknown connection type
        this.lowBandwidthMode = false;
        this.compressionEnabled = true;
        this.requestTimeoutMs = 15000; // 15 seconds
    }
    
    console.log(`Network settings adjusted for ${connectionType}: lowBandwidth=${this.lowBandwidthMode}, compression=${this.compressionEnabled}, timeout=${this.requestTimeoutMs}ms`);
  }

  /**
   * Get retry delay based on retry count (exponential backoff)
   * @param {number} retryCount - Retry count
   * @returns {number} - Retry delay in milliseconds
   */
  static getRetryDelay(retryCount) {
    return Math.min(
      this.retryDelayMs * Math.pow(2, retryCount - 1) + Math.random() * 1000,
      30000 // Max 30 seconds
    );
  }

  /**
   * Add a pending request
   * @param {Object} request - Axios request config
   */
  static addPendingRequest(request) {
    // Generate a unique ID for the request
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    request._pendingRequestId = requestId;
    
    // Add to pending requests
    this.pendingRequests.push(request);
    
    console.log(`Request added to pending queue: ${requestId}`);
  }

  /**
   * Process pending requests
   */
  static processPendingRequests() {
    if (this.pendingRequests.length === 0) return;
    
    console.log(`Processing ${this.pendingRequests.length} pending requests`);
    
    // Process each pending request
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    requests.forEach((request) => {
      // Retry the request
      this.axiosInstance(request).catch((error) => {
        console.error('Error retrying request:', error);
      });
    });
  }

  /**
   * Send an AI request with network optimizations
   * @param {Object} options - Request options
   * @param {string} options.endpoint - API endpoint
   * @param {Object} options.data - Request data
   * @param {Function} options.onSuccess - Success callback
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onOffline - Offline callback
   * @returns {Promise<Object>} - Response data
   */
  static async sendRequest(options) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const { endpoint, data, onSuccess, onError, onOffline } = options;
    
    // Check if we're offline
    if (!this.networkStatus.connected) {
      console.log('Device is offline, storing request for later');
      
      // Store the request for later
      const request = {
        method: 'post',
        url: endpoint,
        data
      };
      
      this.addPendingRequest(request);
      
      // Call offline callback if provided
      if (onOffline) {
        onOffline();
      }
      
      // Return a rejected promise
      return Promise.reject({ isNetworkError: true });
    }
    
    try {
      // Optimize request data for low bandwidth
      let optimizedData = data;
      
      if (this.lowBandwidthMode) {
        optimizedData = this.optimizeRequestData(data);
      }
      
      // Send the request
      const response = await this.axiosInstance.post(endpoint, optimizedData);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      return response.data;
    } catch (error) {
      // Call error callback if provided
      if (onError) {
        onError(error);
      }
      
      // If it's a network error and we have an offline callback
      if (error.isNetworkError && onOffline) {
        onOffline();
      }
      
      return Promise.reject(error);
    }
  }

  /**
   * Optimize request data for low bandwidth
   * @param {Object} data - Request data
   * @returns {Object} - Optimized request data
   */
  static optimizeRequestData(data) {
    // Create a copy of the data
    const optimized = { ...data };
    
    // Optimize message content if present
    if (optimized.message) {
      // Truncate long messages
      if (optimized.message.length > 1000) {
        optimized.message = optimized.message.substring(0, 1000);
      }
    }
    
    // Add low bandwidth flag
    optimized.lowBandwidth = true;
    
    return optimized;
  }

  /**
   * Send an AI message with network optimizations
   * @param {Object} options - Request options
   * @param {string} options.conversationId - Conversation ID
   * @param {string} options.message - User message
   * @param {Function} options.onSuccess - Success callback
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onOffline - Offline callback
   * @returns {Promise<Object>} - Response data
   */
  static async sendMessage(options) {
    const { conversationId, message, onSuccess, onError, onOffline } = options;
    
    return this.sendRequest({
      endpoint: '/api/ai/respond',
      data: {
        conversationId,
        message
      },
      onSuccess,
      onError,
      onOffline
    });
  }

  /**
   * Generate insights with network optimizations
   * @param {Object} options - Request options
   * @param {string} options.conversationId - Conversation ID
   * @param {Function} options.onSuccess - Success callback
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onOffline - Offline callback
   * @returns {Promise<Object>} - Response data
   */
  static async generateInsights(options) {
    const { conversationId, onSuccess, onError, onOffline } = options;
    
    return this.sendRequest({
      endpoint: '/api/ai/insights',
      data: {
        conversationId
      },
      onSuccess,
      onError,
      onOffline
    });
  }

  /**
   * Check if the device is online
   * @returns {boolean} - Whether the device is online
   */
  static isOnline() {
    return this.networkStatus.connected;
  }

  /**
   * Get the current connection type
   * @returns {string} - Connection type
   */
  static getConnectionType() {
    return this.networkStatus.connectionType;
  }

  /**
   * Check if low bandwidth mode is enabled
   * @returns {boolean} - Whether low bandwidth mode is enabled
   */
  static isLowBandwidthMode() {
    return this.lowBandwidthMode;
  }

  /**
   * Set low bandwidth mode
   * @param {boolean} enabled - Whether to enable low bandwidth mode
   */
  static setLowBandwidthMode(enabled) {
    this.lowBandwidthMode = enabled;
    console.log(`Low bandwidth mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export default AINetworkHandler;
