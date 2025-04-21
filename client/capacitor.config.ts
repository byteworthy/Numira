import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.numira.app',
  appName: 'Numira',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // Production Replit URL
    url: 'https://numira.repl.co',
    cleartext: true,
    allowNavigation: ['numira.repl.co', '*.onesignal.com']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#8A6FDF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "large",
      spinnerColor: "#FFFFFF",
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#8A6FDF",
      overlaysWebView: false
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#8A6FDF"
    },
    PrivacyScreen: {
      enable: true,
      imageName: "splash"
    },
    App: {
      appId: "com.numira.app",
      appName: "Numira",
      webDir: "build",
      bundledWebRuntime: false,
      deepLinks: {
        schemes: ["numira"],
        hosts: ["app.numira.com"],
        customScheme: "numira"
      }
    },
    Device: {
      overrideUserAgent: "Numira Mobile App"
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true
    },
    Haptics: {
      selectionStart: true,
      selectionChanged: true,
      selectionEnd: true
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#8A6FDF",
    buildOptions: {
      keystorePath: "numira.keystore",
      keystoreAlias: "numira",
      minSdkVersion: 22,
      targetSdkVersion: 33
    },
    overrideUserAgent: "Numira Android App",
    appendUserAgent: "Numira-Android",
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "VIBRATE",
      "RECEIVE_BOOT_COMPLETED",
      "USE_BIOMETRIC",
      "USE_FINGERPRINT"
    ]
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
    useOnlineAssets: true,
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#8A6FDF",
    preferredContentMode: "mobile",
    overrideUserAgent: "Numira iOS App",
    appendUserAgent: "Numira-iOS",
    permissions: {
      camera: {
        usageDescription: "The app needs camera access to scan QR codes"
      },
      notifications: {
        usageDescription: "Receive notifications about new insights and messages"
      },
      faceID: {
        usageDescription: "Use Face ID to securely access your account"
      }
    }
  }
};

export default config;
