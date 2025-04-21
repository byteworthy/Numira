# Numira Mobile Deployment Guide

This guide provides instructions for deploying the Numira mental clarity app as a native mobile application using CapacitorJS.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- Apple Developer Account (for iOS deployment)
- Google Play Developer Account (for Android deployment)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/numira.git
cd numira
```

### 2. Install Dependencies

Install server dependencies:
```bash
npm install
```

Install client dependencies:
```bash
cd client
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:
```
NODE_ENV=production
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
```

### 4. Build the React Application

```bash
cd client
npm run build
cd ..
```

## Setting Up CapacitorJS

### 1. Initialize Capacitor

```bash
cd client
npm run cap:init
```

This will create the necessary configuration files for Capacitor.

### 2. Add Platforms

For Android:
```bash
npm run cap:add:android
```

For iOS (macOS only):
```bash
npm run cap:add:ios
```

### 3. Update Capacitor Configuration

The `capacitor.config.ts` file should already be configured, but you may need to update the server URL to point to your deployed backend:

```typescript
// client/capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.numira.app',
  appName: 'Numira',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    // Update this URL to your deployed backend
    url: 'https://your-replit-url.repl.co',
    cleartext: true
  },
  // ... other configurations
};

export default config;
```

### 4. Sync Web Code with Native Projects

After making changes to your web code or Capacitor configuration:

```bash
npm run cap:sync
```

## Building for Android

### 1. Open Android Studio

```bash
npm run cap:open:android
```

This will open the Android project in Android Studio.

### 2. Configure App Settings

1. Update the app icon:
   - Navigate to `android/app/src/main/res`
   - Replace the mipmap folders with your custom icons

2. Update app information in `android/app/src/main/AndroidManifest.xml`:
   - Permissions
   - App name
   - Other configurations

### 3. Build the App Bundle (.aab)

1. In Android Studio, select `Build > Generate Signed Bundle / APK`
2. Choose `Android App Bundle`
3. Create or select a keystore for signing
4. Fill in the keystore details
5. Select a destination folder
6. Click `Finish` to build the app bundle

The resulting `.aab` file can be uploaded to the Google Play Store.

## Building for iOS (macOS only)

### 1. Open Xcode

```bash
npm run cap:open:ios
```

This will open the iOS project in Xcode.

### 2. Configure App Settings

1. Update the app icon:
   - Select `Assets.xcassets` in the Project Navigator
   - Replace the AppIcon with your custom icons

2. Update app information:
   - Select the project in the Project Navigator
   - Update Bundle Identifier, Version, etc.

### 3. Build the App (.ipa)

1. Connect your Apple Developer account in Xcode
2. Select a development team
3. Choose a device or simulator for testing
4. Select `Product > Archive` to create an archive
5. In the Archives window, click `Distribute App`
6. Follow the prompts to create an `.ipa` file

The resulting `.ipa` file can be uploaded to the App Store.

## Submitting to App Stores

### Google Play Store

1. Create a new app in the [Google Play Console](https://play.google.com/console)
2. Fill in the app details, screenshots, and descriptions
3. Upload the `.aab` file
4. Set up pricing and distribution
5. Submit for review

### Apple App Store

1. Create a new app in [App Store Connect](https://appstoreconnect.apple.com)
2. Fill in the app details, screenshots, and descriptions
3. Upload the `.ipa` file using Xcode or Application Loader
4. Set up pricing and distribution
5. Submit for review

## Additional Mobile-Specific Features

### Splash Screen

The splash screen is configured in `capacitor.config.ts`. You can customize it by:

1. Creating splash screen images in various sizes
2. Placing them in the appropriate directories:
   - Android: `android/app/src/main/res/drawable`
   - iOS: Add to Xcode project

### Offline Mode

Numira includes offline functionality that:
- Caches conversations for offline viewing
- Allows users to compose messages while offline
- Automatically syncs when the device reconnects

### Touch Optimization

The UI has been optimized for touch interactions with:
- Larger touch targets (minimum 44×44px)
- Appropriate spacing between interactive elements
- Mobile-friendly input fields

## Troubleshooting

### Common Issues

1. **Build Errors**:
   - Ensure all dependencies are installed
   - Check that the capacitor.config.ts is properly configured
   - Verify that the webDir points to the correct build directory

2. **API Connection Issues**:
   - Verify the server URL in capacitor.config.ts
   - Check that CORS is properly configured on the backend
   - Ensure the device has internet connectivity

3. **Plugin Issues**:
   - Run `npm run cap:sync` after installing new Capacitor plugins
   - Check plugin documentation for platform-specific setup

### Getting Help

If you encounter issues not covered in this guide:
- Check the [Capacitor documentation](https://capacitorjs.com/docs)
- Search for solutions on Stack Overflow
- File an issue in the project repository

## Maintenance

### Updating the App

1. Make changes to the web application
2. Rebuild the web app: `npm run build`
3. Sync with Capacitor: `npm run cap:sync`
4. Open the native projects and rebuild

### Version Management

When releasing updates:
1. Update the version number in:
   - client/package.json
   - Android: build.gradle
   - iOS: Info.plist
2. Create a new build following the steps above
3. Submit the new version to the app stores
