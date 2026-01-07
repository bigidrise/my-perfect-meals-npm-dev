import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myperfectmeals.app',
  appName: 'My Perfect Meals',
  webDir: 'dist',
  // NOTE: Temporarily removed server.url to test native plugins with local bundle.
  // Once confirmed working, redeploy production and restore this:
  // server: {
  //   url: 'https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app',
  //   cleartext: false,
  // },
};

export default config;

