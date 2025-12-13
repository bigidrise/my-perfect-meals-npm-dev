import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

interface UpdateBannerProps {
  version: string;
  changelogUrl?: string;
  onUpdate: () => void;
}

export function UpdateBanner({ version, changelogUrl, onUpdate }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
      <Alert className="bg-black/60 border border-white/20 backdrop-blur-none rounded-2xl shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <AlertDescription className="text-white flex items-center gap-2 flex-wrap">
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">Update available</span>
              <span className="text-white/60 text-sm">·</span>
              <span className="text-white/60 text-sm">Version {version}</span>
            </AlertDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={onUpdate}
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium min-h-[40px] min-w-[40px]"
              data-testid="button-update-app"
            >
              Update
            </Button>
            
            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Dismiss update notification"
              data-testid="button-dismiss-update"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
