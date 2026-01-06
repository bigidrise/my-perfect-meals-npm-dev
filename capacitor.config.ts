import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myperfectmeals.app',
  appName: 'My Perfect Meals',
  webDir: 'dist',
  server: {
    url: 'https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app',
    cleartext: false,
  },
};

export default config;

