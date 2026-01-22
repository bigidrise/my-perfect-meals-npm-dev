import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

interface UpdateNotificationProps {
  onUpdate: () => void;
  onDismiss?: () => void;
}

export function UpdateNotification({ onUpdate, onDismiss }: UpdateNotificationProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
      data-testid="update-notification"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <div>
            <p className="font-semibold">New Version Available</p>
            <p className="text-sm text-white/90">Update now to get the latest features and improvements</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpdate}
            className="bg-white text-purple-600 hover:bg-white/90 font-semibold"
            size="sm"
            data-testid="button-update-now"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Update Now
          </Button>
          
          {onDismiss && (
            <Button
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              data-testid="button-dismiss-update"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to detect service worker updates
// BIG-APP PATTERN: Never auto-reload. Only show banner, let user control refresh.
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [userRequestedRefresh, setUserRequestedRefresh] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // CRITICAL: Check if a worker is already waiting (missed update case)
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
          // Dispatch event for global update manager
          window.dispatchEvent(new CustomEvent('mpm:update-available'));
        }

        // Check for new updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                // Dispatch event for global update manager
                window.dispatchEvent(new CustomEvent('mpm:update-available'));
              }
            });
          }
        });

        // Manually check for updates (silent, no reload)
        reg.update().catch(() => {});
      });

      // REMOVED: Auto-reload on controllerchange - this was causing random flashes
      // Only reload on controllerchange if USER explicitly requested it
      const handleControllerChange = () => {
        if (userRequestedRefresh) {
          console.log('🔄 [MPM Update] User-initiated refresh after SW activation');
          window.location.reload();
        } else {
          console.log('📝 [MPM Update] SW controller changed, but no user request - skipping reload');
        }
      };
      
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, [userRequestedRefresh]);

  const updateServiceWorker = () => {
    // Mark that user explicitly requested refresh
    setUserRequestedRefresh(true);
    
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Give SW time to activate, then reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      // No waiting worker, just reload
      window.location.reload();
    }
  };

  return {
    updateAvailable,
    updateServiceWorker,
  };
}
