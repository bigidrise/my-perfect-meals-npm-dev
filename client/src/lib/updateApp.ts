// App update mechanism - handles service worker updates and reloads
// BIG-APP PATTERN: Only reload when user explicitly requests it
import { forceReloadWithCacheClear, clearWebViewCache } from './webviewCache';

/**
 * User-initiated app update - called when user clicks "Update Now" button
 * This is the ONLY place that should trigger a reload for updates
 */
export async function updateApp() {
  console.log('🔄 [MPM Update] User-initiated app update starting...');
  
  // Clear WKWebView cache first on iOS (critical for updates)
  await clearWebViewCache();
  
  // Check if service worker is available
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        console.log('⏳ [MPM Update] Activating waiting service worker...');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Give SW time to activate, then reload
        setTimeout(async () => {
          console.log('✅ [MPM Update] Reloading with cache clear...');
          await forceReloadWithCacheClear();
        }, 500);
      } else {
        // No waiting worker, just reload with cache clear
        console.log('🔄 [MPM Update] No waiting worker, reloading with cache clear...');
        await forceReloadWithCacheClear();
      }
    } catch (error) {
      console.error('[MPM Update] Service worker error:', error);
      await forceReloadWithCacheClear();
    }
  } else {
    console.log('🔄 [MPM Update] No SW support, reloading with cache clear...');
    await forceReloadWithCacheClear();
  }
}

/**
 * Silent update check - does NOT reload, only signals if update available
 * Use this for background version checking
 */
export async function checkForUpdatesSilently(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    
    // Check for updates silently
    await registration.update();
    
    // Return true if there's a waiting worker
    if (registration.waiting) {
      window.dispatchEvent(new CustomEvent('mpm:update-available'));
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}
