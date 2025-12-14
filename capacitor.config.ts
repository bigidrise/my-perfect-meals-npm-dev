import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myperfectmeals.app',
  appName: 'My Perfect Meals',
  webDir: 'client/dist',
  server: {
    url: 'https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
