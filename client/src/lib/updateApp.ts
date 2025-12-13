// App update mechanism - handles service worker updates and reloads

export async function updateApp() {
  console.log('🔄 Starting app update...');
  
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
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              console.log('✅ New service worker activated, reloading...');
              // Reload to get the new version
              window.location.reload();
              resolve();
            });
            
            // Fallback: if controllerchange doesn't fire within 3 seconds, reload anyway
            setTimeout(() => {
              console.log('⏱️ Timeout waiting for controller change, reloading anyway');
              window.location.reload();
              resolve();
            }, 3000);
          });
        } else {
          // No waiting worker, check for updates
          console.log('🔍 No waiting worker, checking for updates');
          await registration.update();
          
          // After update check, reload
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        // No service worker registered, just reload
        console.log('❌ No service worker registered, performing simple reload');
        reloadPreservingRoute();
      }
    } catch (error) {
      console.error('Service worker update error:', error);
      // Fallback to simple reload
      reloadPreservingRoute();
    }
  } else {
    // Service worker not supported, just reload
    console.log('❌ Service worker not supported, performing simple reload');
    reloadPreservingRoute();
  }
}

// Reload while preserving the current route
function reloadPreservingRoute() {
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  console.log(`🔄 Reloading with preserved route: ${currentPath}`);
  
  // Use location.replace to reload without adding to history
  window.location.replace(currentPath);
}
