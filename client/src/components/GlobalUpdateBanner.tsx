import { useUpdateManager } from '@/contexts/UpdateManagerContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export function GlobalUpdateBanner() {
  const { updateAvailable, dismissedThisSession, dismissUpdate } = useUpdateManager();

  if (!updateAvailable || dismissedThisSession) {
    return null;
  }

  const handleRefresh = () => {
    // Immediate hard reload - no service worker complexity
    window.location.href = window.location.href;
  };

  return (
    <div 
      className="fixed left-4 right-4 z-[100] bg-black/95 text-white shadow-2xl rounded-xl border border-orange-500/30"
      style={{ bottom: 'calc(var(--safe-bottom, 0px) + 80px)' }}
      data-testid="global-update-banner"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-orange-400" />
          <div>
            <p className="font-semibold text-sm">Update Available</p>
            <p className="text-xs text-white/70">Tap to refresh</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            className="bg-orange-500 text-white hover:bg-orange-600 font-semibold text-xs px-4 py-2 h-auto rounded-lg"
            size="sm"
            data-testid="button-refresh-now"
          >
            Refresh
          </Button>
          
          <Button
            onClick={dismissUpdate}
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10 p-1 h-auto"
            data-testid="button-later"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
