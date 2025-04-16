import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import SecureStorage from './secureStorage';

/**
 * Utility for handling in-app purchases and subscriptions
 */
class PurchaseManager {
  static initialized = false;
  static purchases = [];
  static subscriptions = [];

  /**
   * Initialize the purchase manager
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      if (Capacitor.isNativePlatform()) {
        // Dynamically import the appropriate plugin based on platform
        if (Capacitor.getPlatform() === 'ios') {
          const { InAppPurchase } = await import('@ionic-native/in-app-purchase-2');
          await this.initializeIOS(InAppPurchase);
        } else if (Capacitor.getPlatform() === 'android') {
          const { InAppPurchase2 } = await import('@ionic-native/in-app-purchase-2');
          await this.initializeAndroid(InAppPurchase2);
        }
      } else {
        // For web, we'll use a simulated purchase system
        await this.initializeWeb();
      }

      this.initialized = true;
      console.log('Purchase manager initialized');
    } catch (error) {
      console.error('Error initializing purchase manager:', error);
    }
  }

  /**
   * Initialize for iOS
   * @param {Object} InAppPurchase - The InAppPurchase plugin
   * @returns {Promise<void>}
   */
  static async initializeIOS(InAppPurchase) {
    // Define products
    const products = [
      {
        id: 'numira.premium.monthly',
        type: InAppPurchase.PAID_SUBSCRIPTION
      },
      {
        id: 'numira.premium.yearly',
        type: InAppPurchase.PAID_SUBSCRIPTION
      },
      {
        id: 'numira.insights.pack',
        type: InAppPurchase.CONSUMABLE
      }
    ];

    // Register products
    products.forEach(product => {
      InAppPurchase.register({
        id: product.id,
        type: product.type
      });
    });

    // Setup event handlers
    InAppPurchase.when('numira.premium.monthly').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    InAppPurchase.when('numira.premium.yearly').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    InAppPurchase.when('numira.insights.pack').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    // Handle errors
    InAppPurchase.error(error => {
      console.error('IAP Error:', error);
    });

    // Refresh status of purchases
    try {
      await InAppPurchase.refresh();
    } catch (error) {
      console.error('Error refreshing purchases:', error);
    }

    // Store the instance for later use
    this.iap = InAppPurchase;
  }

  /**
   * Initialize for Android
   * @param {Object} InAppPurchase2 - The InAppPurchase2 plugin
   * @returns {Promise<void>}
   */
  static async initializeAndroid(InAppPurchase2) {
    // Define products
    const products = [
      {
        id: 'numira.premium.monthly',
        type: InAppPurchase2.PAID_SUBSCRIPTION
      },
      {
        id: 'numira.premium.yearly',
        type: InAppPurchase2.PAID_SUBSCRIPTION
      },
      {
        id: 'numira.insights.pack',
        type: InAppPurchase2.CONSUMABLE
      }
    ];

    // Register products
    products.forEach(product => {
      InAppPurchase2.register({
        id: product.id,
        type: product.type
      });
    });

    // Setup event handlers
    InAppPurchase2.when('numira.premium.monthly').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    InAppPurchase2.when('numira.premium.yearly').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    InAppPurchase2.when('numira.insights.pack').approved(product => {
      product.verify();
    }).verified(product => {
      product.finish();
      this.handlePurchaseSuccess(product);
    });

    // Handle errors
    InAppPurchase2.error(error => {
      console.error('IAP Error:', error);
    });

    // Refresh status of purchases
    try {
      await InAppPurchase2.refresh();
    } catch (error) {
      console.error('Error refreshing purchases:', error);
    }

    // Store the instance for later use
    this.iap = InAppPurchase2;
  }

  /**
   * Initialize for web (simulated purchases)
   * @returns {Promise<void>}
   */
  static async initializeWeb() {
    // For web, we'll use a simulated purchase system
    // Fetch available products from the server
    try {
      const response = await axios.get('/api/products');
      this.products = response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      this.products = [
        {
          id: 'numira.premium.monthly',
          title: 'Premium Monthly',
          description: 'Monthly subscription to Numira Premium',
          price: '$4.99',
          type: 'subscription'
        },
        {
          id: 'numira.premium.yearly',
          title: 'Premium Yearly',
          description: 'Yearly subscription to Numira Premium (Save 20%)',
          price: '$47.99',
          type: 'subscription'
        },
        {
          id: 'numira.insights.pack',
          title: 'Insights Pack',
          description: 'Pack of 10 additional AI insights',
          price: '$2.99',
          type: 'consumable'
        }
      ];
    }

    // Check for existing purchases
    const storedPurchases = await SecureStorage.getItem('purchases', true);
    if (storedPurchases) {
      this.purchases = storedPurchases;
    }

    // Check for existing subscriptions
    const storedSubscriptions = await SecureStorage.getItem('subscriptions', true);
    if (storedSubscriptions) {
      this.subscriptions = storedSubscriptions;
    }
  }

  /**
   * Get available products
   * @returns {Promise<Array>} - Array of available products
   */
  static async getProducts() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const products = await this.iap.products;
        return products;
      } catch (error) {
        console.error('Error getting products:', error);
        return [];
      }
    } else {
      // For web, return the simulated products
      return this.products || [];
    }
  }

  /**
   * Purchase a product
   * @param {string} productId - ID of the product to purchase
   * @returns {Promise<boolean>} - Whether the purchase was successful
   */
  static async purchase(productId) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const product = this.iap.get(productId);
        await this.iap.order(product);
        return true;
      } catch (error) {
        console.error('Error purchasing product:', error);
        return false;
      }
    } else {
      // For web, simulate a purchase
      try {
        const response = await axios.post('/api/purchase', { productId });
        
        if (response.data.success) {
          const product = this.products.find(p => p.id === productId);
          
          if (product.type === 'subscription') {
            // Add to subscriptions
            const subscription = {
              id: productId,
              purchaseDate: new Date().toISOString(),
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
              autoRenewing: true
            };
            
            this.subscriptions.push(subscription);
            await SecureStorage.setItem('subscriptions', this.subscriptions, true);
          } else {
            // Add to purchases
            const purchase = {
              id: productId,
              purchaseDate: new Date().toISOString()
            };
            
            this.purchases.push(purchase);
            await SecureStorage.setItem('purchases', this.purchases, true);
          }
          
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('Error simulating purchase:', error);
        return false;
      }
    }
  }

  /**
   * Handle successful purchase
   * @param {Object} product - The purchased product
   * @returns {Promise<void>}
   */
  static async handlePurchaseSuccess(product) {
    try {
      // Verify the purchase with our server
      const receipt = product.transaction.receipt || product.transaction;
      
      const response = await axios.post('/api/verify-purchase', {
        productId: product.id,
        receipt,
        platform: Capacitor.getPlatform()
      });
      
      if (response.data.success) {
        // Update local state
        if (product.type === this.iap.PAID_SUBSCRIPTION) {
          // Add to subscriptions
          const subscription = {
            id: product.id,
            purchaseDate: new Date().toISOString(),
            expiryDate: response.data.expiryDate,
            autoRenewing: response.data.autoRenewing
          };
          
          this.subscriptions.push(subscription);
          await SecureStorage.setItem('subscriptions', this.subscriptions, true);
        } else {
          // Add to purchases
          const purchase = {
            id: product.id,
            purchaseDate: new Date().toISOString()
          };
          
          this.purchases.push(purchase);
          await SecureStorage.setItem('purchases', this.purchases, true);
        }
      }
    } catch (error) {
      console.error('Error verifying purchase with server:', error);
    }
  }

  /**
   * Check if user has an active subscription
   * @returns {Promise<boolean>} - Whether the user has an active subscription
   */
  static async hasActiveSubscription() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const monthlySubscription = this.iap.get('numira.premium.monthly');
        const yearlySubscription = this.iap.get('numira.premium.yearly');
        
        return monthlySubscription.owned || yearlySubscription.owned;
      } catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
      }
    } else {
      // For web, check the stored subscriptions
      if (!this.subscriptions || this.subscriptions.length === 0) {
        return false;
      }
      
      const now = new Date();
      
      // Check if any subscription is active
      return this.subscriptions.some(subscription => {
        const expiryDate = new Date(subscription.expiryDate);
        return expiryDate > now;
      });
    }
  }

  /**
   * Restore purchases
   * @returns {Promise<boolean>} - Whether the restore was successful
   */
  static async restorePurchases() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await this.iap.refresh();
        return true;
      } catch (error) {
        console.error('Error restoring purchases:', error);
        return false;
      }
    } else {
      // For web, we'll simulate restoring purchases from the server
      try {
        const response = await axios.get('/api/restore-purchases');
        
        if (response.data.success) {
          this.purchases = response.data.purchases || [];
          this.subscriptions = response.data.subscriptions || [];
          
          await SecureStorage.setItem('purchases', this.purchases, true);
          await SecureStorage.setItem('subscriptions', this.subscriptions, true);
          
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('Error restoring purchases:', error);
        return false;
      }
    }
  }
}

export default PurchaseManager;
