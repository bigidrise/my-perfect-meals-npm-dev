import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myperfectmeals.app',
  appName: 'My Perfect Meals',
  webDir: 'client/dist',
  server: {
    url: 'https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app',
    cleartext: false,
  },
  ios: {
    // Prevent white flash during WebView transitions
    backgroundColor: '#000000',
    // Disable scroll bounce that can reveal white background
    scrollEnabled: false,
    // Reduce visual artifacts during page transitions
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      // Keep splash screen visible until app signals it's ready
      launchAutoHide: false,
      // Use black background to match app theme
      backgroundColor: '#000000',
      // Smooth fade transition
      fadeOutDuration: 300,
      // Show spinner while loading
      showSpinner: false,
    },
  },
};

export default config;

