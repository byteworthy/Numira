import { Storage } from '@capacitor/storage';
import axios from 'axios';

/**
 * Utility for handling offline storage and synchronization
 */
class OfflineStorage {
  /**
   * Save a conversation to local storage
   * @param {Object} conversation - The conversation object to save
   * @returns {Promise<void>}
   */
  static async saveConversation(conversation) {
    try {
      // Get existing conversations
      const { value } = await Storage.get({ key: 'offline_conversations' });
      let conversations = value ? JSON.parse(value) : [];
      
      // Check if conversation already exists
      const index = conversations.findIndex(c => c._id === conversation._id);
      
      if (index !== -1) {
        // Update existing conversation
        conversations[index] = conversation;
      } else {
        // Add new conversation
        conversations.push(conversation);
      }
      
      // Save back to storage
      await Storage.set({
        key: 'offline_conversations',
        value: JSON.stringify(conversations)
      });
      
      // Also save the conversation individually for faster access
      await Storage.set({
        key: `conversation_${conversation._id}`,
        value: JSON.stringify(conversation)
      });
      
      // Mark for sync when online
      await this.markForSync(conversation._id, 'conversation');
    } catch (error) {
      console.error('Error saving conversation to offline storage:', error);
    }
  }
  
  /**
   * Get a conversation from local storage
   * @param {string} id - The conversation ID
   * @returns {Promise<Object|null>} - The conversation object or null if not found
   */
  static async getConversation(id) {
    try {
      const { value } = await Storage.get({ key: `conversation_${id}` });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting conversation from offline storage:', error);
      return null;
    }
  }
  
  /**
   * Get all conversations from local storage
   * @returns {Promise<Array>} - Array of conversation objects
   */
  static async getAllConversations() {
    try {
      const { value } = await Storage.get({ key: 'offline_conversations' });
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error('Error getting all conversations from offline storage:', error);
      return [];
    }
  }
  
  /**
   * Save a message to be sent when online
   * @param {string} conversationId - The conversation ID
   * @param {string} message - The message content
   * @returns {Promise<void>}
   */
  static async saveOfflineMessage(conversationId, message) {
    try {
      // Get existing offline messages
      const { value } = await Storage.get({ key: 'offline_messages' });
      let messages = value ? JSON.parse(value) : [];
      
      // Add new message
      messages.push({
        conversationId,
        message,
        timestamp: Date.now()
      });
      
      // Save back to storage
      await Storage.set({
        key: 'offline_messages',
        value: JSON.stringify(messages)
      });
      
      // Update local conversation with user message
      const conversation = await this.getConversation(conversationId);
      if (conversation) {
        conversation.messages.push({
          content: message,
          role: 'user',
          timestamp: Date.now(),
          offline: true
        });
        await this.saveConversation(conversation);
      }
    } catch (error) {
      console.error('Error saving offline message:', error);
    }
  }
  
  /**
   * Mark an item for synchronization when online
   * @param {string} id - The item ID
   * @param {string} type - The item type (conversation, message, etc.)
   * @returns {Promise<void>}
   */
  static async markForSync(id, type) {
    try {
      // Get existing sync queue
      const { value } = await Storage.get({ key: 'sync_queue' });
      let queue = value ? JSON.parse(value) : [];
      
      // Check if already in queue
      if (!queue.find(item => item.id === id && item.type === type)) {
        // Add to queue
        queue.push({
          id,
          type,
          timestamp: Date.now()
        });
        
        // Save back to storage
        await Storage.set({
          key: 'sync_queue',
          value: JSON.stringify(queue)
        });
      }
    } catch (error) {
      console.error('Error marking for sync:', error);
    }
  }
  
  /**
   * Synchronize offline data with the server
   * @returns {Promise<void>}
   */
  static async syncWithServer() {
    try {
      // Check if online
      if (!navigator.onLine) {
        console.log('Cannot sync: Device is offline');
        return;
      }
      
      // Get sync queue
      const { value } = await Storage.get({ key: 'sync_queue' });
      if (!value) return;
      
      const queue = JSON.parse(value);
      if (queue.length === 0) return;
      
      // Get offline messages
      const { value: messagesValue } = await Storage.get({ key: 'offline_messages' });
      const offlineMessages = messagesValue ? JSON.parse(messagesValue) : [];
      
      // Process offline messages first
      for (const offlineMsg of offlineMessages) {
        try {
          await axios.post('/api/ai/respond', {
            conversationId: offlineMsg.conversationId,
            message: offlineMsg.message
          });
        } catch (error) {
          console.error('Error syncing offline message:', error);
          // Keep in queue for next attempt
          continue;
        }
      }
      
      // Clear offline messages if all were processed
      await Storage.set({
        key: 'offline_messages',
        value: JSON.stringify([])
      });
      
      // Clear sync queue
      await Storage.set({
        key: 'sync_queue',
        value: JSON.stringify([])
      });
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error during sync:', error);
    }
  }
  
  /**
   * Check if the device is online
   * @returns {boolean}
   */
  static isOnline() {
    return navigator.onLine;
  }
  
  /**
   * Set up online/offline event listeners
   * @param {Function} onOnline - Callback when device goes online
   * @param {Function} onOffline - Callback when device goes offline
   */
  static setupConnectivityListeners(onOnline, onOffline) {
    window.addEventListener('online', () => {
      console.log('Device is online');
      if (typeof onOnline === 'function') onOnline();
      this.syncWithServer();
    });
    
    window.addEventListener('offline', () => {
      console.log('Device is offline');
      if (typeof onOffline === 'function') onOffline();
    });
  }
}

export default OfflineStorage;
