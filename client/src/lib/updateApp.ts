// App update mechanism - handles service worker updates and reloads
import { forceReloadWithCacheClear, clearWebViewCache } from './webviewCache';

export async function updateApp() {
  console.log('🔄 Starting app update...');
  
  // Clear WKWebView cache first on iOS (critical for updates)
  await clearWebViewCache();
  
  // Check if service worker is available
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        console.log('📦 Service worker found, triggering update flow');
        
        // If there's a waiting worker, activate it
        if (registration.waiting) {
          console.log('⏳ Waiting worker found, sending SKIP_WAITING message');
          
          // Send message to waiting worker to skip waiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Wait for the new service worker to take control
          return new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', async () => {
              console.log('✅ New service worker activated, reloading with cache clear...');
              await forceReloadWithCacheClear();
              resolve();
            });
            
            // Fallback: if controllerchange doesn't fire within 3 seconds, reload anyway
            setTimeout(async () => {
              console.log('⏱️ Timeout waiting for controller change, reloading with cache clear');
              await forceReloadWithCacheClear();
              resolve();
            }, 3000);
          });
        } else {
          // No waiting worker, check for updates
          console.log('🔍 No waiting worker, checking for updates');
          await registration.update();
          
          // After update check, reload with cache clear
          setTimeout(async () => {
            await forceReloadWithCacheClear();
          }, 1000);
        }
      } else {
        // No service worker registered, force reload with cache clear
        console.log('❌ No service worker registered, performing cache-cleared reload');
        await forceReloadWithCacheClear();
      }
    } catch (error) {
      console.error('Service worker update error:', error);
      // Fallback to cache-cleared reload
      await forceReloadWithCacheClear();
    }
  } else {
    // Service worker not supported, force reload with cache clear
    console.log('❌ Service worker not supported, performing cache-cleared reload');
    await forceReloadWithCacheClear();
  }
}

// Reload while preserving the current route
function reloadPreservingRoute() {
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  console.log(`🔄 Reloading with preserved route: ${currentPath}`);
  
  // Use location.replace to reload without adding to history
  window.location.replace(currentPath);
}
