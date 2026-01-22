import { useState } from 'react';
import { useUpdateManager } from '@/contexts/UpdateManagerContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { currentRelease } from '@/lib/releaseNotes';

export function GlobalUpdateBanner() {
  const { updateAvailable, dismissedThisSession, dismissUpdate } = useUpdateManager();
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  if (!updateAvailable || dismissedThisSession) {
    return null;
  }

  const handleRefresh = () => {
    window.location.href = window.location.href;
  };

  return (
    <>
      <div 
        className="fixed left-4 right-4 z-[100] bg-black/95 text-white shadow-2xl rounded-xl border border-orange-500/30"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + 80px)' }}
        data-testid="global-update-banner"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <RefreshCw className="h-5 w-5 text-orange-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">Update Available</p>
              <p className="text-xs text-white/70">Tap to refresh</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowWhatsNew(true)}
              className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors flex items-center gap-1.5"
              data-testid="button-whats-new"
            >
              <Sparkles className="h-3 w-3" />
              What's New
            </button>
            
            <Button
              onClick={handleRefresh}
              className="bg-orange-500 text-white hover:bg-orange-600 font-semibold text-xs px-4 py-2 h-auto rounded-full"
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

      {showWhatsNew && (
        <div 
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowWhatsNew(false)}
        >
          <div 
            className="bg-zinc-900 rounded-2xl border border-orange-500/30 max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <h2 className="text-lg font-bold text-white">What's New</h2>
              </div>
              <button 
                onClick={() => setShowWhatsNew(false)}
                className="text-white/60 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-white/50 text-xs mb-4">{currentRelease.date}</p>
              
              {currentRelease.bugFixes.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-orange-400 font-semibold text-sm mb-2">Bug Fixes</h3>
                  <ul className="space-y-2">
                    {currentRelease.bugFixes.map((fix, i) => (
                      <li key={i} className="text-white/80 text-sm flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {currentRelease.designUpdates.length > 0 && (
                <div>
                  <h3 className="text-orange-400 font-semibold text-sm mb-2">Design Updates</h3>
                  <ul className="space-y-2">
                    {currentRelease.designUpdates.map((update, i) => (
                      <li key={i} className="text-white/80 text-sm flex items-start gap-2">
                        <span className="text-orange-400 mt-0.5">✦</span>
                        {update}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-white/50 text-xs text-center">
                  Your feedback helps us improve. Thank you for using My Perfect Meals!
                </p>
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-white/10">
              <Button
                onClick={() => {
                  setShowWhatsNew(false);
                  handleRefresh();
                }}
                className="w-full bg-orange-500 text-white hover:bg-orange-600 font-semibold rounded-full py-3"
              >
                Update Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
