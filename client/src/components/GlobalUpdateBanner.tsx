import { useUpdateManager } from '@/contexts/UpdateManagerContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export function GlobalUpdateBanner() {
  const { updateAvailable, dismissedThisSession, applyUpdate, dismissUpdate } = useUpdateManager();

  if (!updateAvailable || dismissedThisSession) {
    return null;
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg safe-area-inset-top"
      data-testid="global-update-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5" />
          <div>
            <p className="font-semibold text-sm">Update Available</p>
            <p className="text-xs text-white/90">Refresh when you're ready</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={applyUpdate}
            className="bg-white text-purple-600 hover:bg-white/90 font-semibold text-xs px-3 py-1 h-auto"
            size="sm"
            data-testid="button-refresh-now"
          >
            Refresh
          </Button>
          
          <Button
            onClick={dismissUpdate}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 p-1 h-auto"
            data-testid="button-later"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
