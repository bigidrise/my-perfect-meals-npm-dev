import { X, Sparkles, RefreshCw } from 'lucide-react';
import { useReleaseNotice } from '@/hooks/useReleaseNotice';

export function WhatsNewBanner() {
  const { showBanner, dismiss, update } = useReleaseNotice();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 safe-area-bottom">
      <div className="bg-black border border-orange-500/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-white text-sm">Update available</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={update}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button onClick={dismiss} className="text-white/40 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
