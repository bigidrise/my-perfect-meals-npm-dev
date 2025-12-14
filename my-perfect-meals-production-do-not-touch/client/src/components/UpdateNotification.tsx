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
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // CRITICAL: Check if a worker is already waiting (missed update case)
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }

        // Check for new updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Manually check for updates
        reg.update();
      });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  const updateServiceWorker = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // CRITICAL: Force immediate reload with cache bust to show new content
    // Don't wait for controllerchange - it may not fire reliably on iOS
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return {
    updateAvailable,
    updateServiceWorker,
  };
}
