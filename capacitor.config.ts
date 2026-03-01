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
    backgroundColor: '#000000',
    scrollEnabled: false,
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#000000',
      fadeOutDuration: 300,
      showSpinner: false,
    },
  },
};

export default config;
