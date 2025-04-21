import OneSignal from '@onesignal/onesignal-web-sdk';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

// OneSignal App ID - replace with your actual OneSignal App ID
const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';

class NotificationService {
  static initialized = false;

  /**
   * Initialize the notification service
   * @param {string} userId - User ID for targeting notifications
   */
  static async initialize(userId) {
    if (this.initialized) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await this.initializeNative(userId);
      } else {
        await this.initializeWeb(userId);
      }
      this.initialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  /**
   * Initialize OneSignal for web
   * @param {string} userId - User ID for targeting notifications
   */
  static async initializeWeb(userId) {
    // Initialize OneSignal
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js'
    });

    // Set external user ID
    if (userId) {
      await OneSignal.setExternalUserId(userId);
    }

    // Request permission
    await OneSignal.Notifications.requestPermission();
  }

  /**
   * Initialize native push notifications
   * @param {string} userId - User ID for targeting notifications
   */
  static async initializeNative(userId) {
    // Request permission
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive === 'granted') {
      // Register with device
      await PushNotifications.register();
      
      // Set up listeners
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        this.saveDeviceToken(token.value, userId);
      });
      
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration:', error);
      });
      
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        this.showLocalNotification(notification);
      });
      
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
        // Handle notification click
        if (action.notification.data && action.notification.data.url) {
          window.location.href = action.notification.data.url;
        }
      });
    }
    
    // Initialize local notifications
    await LocalNotifications.requestPermissions();
  }

  /**
   * Save device token to backend
   * @param {string} token - Device token
   * @param {string} userId - User ID
   */
  static async saveDeviceToken(token, userId) {
    try {
      const response = await fetch('/api/users/device-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          userId,
          platform: Capacitor.getPlatform()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save device token');
      }
      
      console.log('Device token saved successfully');
    } catch (error) {
      console.error('Error saving device token:', error);
    }
  }

  /**
   * Show a local notification
   * @param {Object} notification - Notification data
   */
  static async showLocalNotification(notification) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'Numira',
            body: notification.body || '',
            id: new Date().getTime(),
            extra: notification.data
          }
        ]
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  /**
   * Send a test notification
   * @param {string} userId - User ID to target
   */
  static async sendTestNotification(userId) {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }
      
      console.log('Test notification sent successfully');
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  /**
   * Subscribe to a topic
   * @param {string} topic - Topic to subscribe to
   */
  static async subscribeToTopic(topic) {
    if (Capacitor.isNativePlatform()) {
      // For native, we handle this on the backend
      try {
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to subscribe to topic');
        }
        
        console.log(`Subscribed to topic: ${topic}`);
      } catch (error) {
        console.error('Error subscribing to topic:', error);
      }
    } else {
      // For web
      try {
        await OneSignal.User.addTag('topic', topic);
        console.log(`Subscribed to topic: ${topic}`);
      } catch (error) {
        console.error('Error subscribing to topic:', error);
      }
    }
  }

  /**
   * Unsubscribe from a topic
   * @param {string} topic - Topic to unsubscribe from
   */
  static async unsubscribeFromTopic(topic) {
    if (Capacitor.isNativePlatform()) {
      // For native, we handle this on the backend
      try {
        const response = await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ topic }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to unsubscribe from topic');
        }
        
        console.log(`Unsubscribed from topic: ${topic}`);
      } catch (error) {
        console.error('Error unsubscribing from topic:', error);
      }
    } else {
      // For web
      try {
        await OneSignal.User.removeTag('topic');
        console.log(`Unsubscribed from topic: ${topic}`);
      } catch (error) {
        console.error('Error unsubscribing from topic:', error);
      }
    }
  }

  /**
   * Enable or disable notifications
   * @param {boolean} enabled - Whether notifications should be enabled
   */
  static async setNotificationsEnabled(enabled) {
    if (Capacitor.isNativePlatform()) {
      // For native, we just store the preference
      localStorage.setItem('notifications_enabled', enabled.toString());
    } else {
      // For web
      try {
        if (enabled) {
          await OneSignal.Notifications.requestPermission();
        } else {
          await OneSignal.User.disablePush();
        }
      } catch (error) {
        console.error('Error setting notifications enabled:', error);
      }
    }
  }

  /**
   * Check if notifications are enabled
   * @returns {Promise<boolean>} - Whether notifications are enabled
   */
  static async areNotificationsEnabled() {
    if (Capacitor.isNativePlatform()) {
      // For native
      const enabled = localStorage.getItem('notifications_enabled');
      return enabled === 'true';
    } else {
      // For web
      try {
        const permission = await OneSignal.Notifications.permission;
        return permission;
      } catch (error) {
        console.error('Error checking if notifications are enabled:', error);
        return false;
      }
    }
  }
}

export default NotificationService;
