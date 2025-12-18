import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ForcedUpdateModalProps {
  currentVersion: string;
  requiredVersion: string;
  onUpdate: () => void;
}

export function ForcedUpdateModal({ currentVersion, requiredVersion, onUpdate }: ForcedUpdateModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black/60 border border-white/20 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-500/20 p-3 rounded-full">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">
          Update Required
        </h2>
        
        <p className="text-white/80 mb-6">
          A newer version of the app is required to continue.
        </p>
        
        <div className="bg-white/5 rounded-lg p-3 mb-6 text-sm text-white/70">
          <div className="flex justify-between mb-1">
            <span>Current version:</span>
            <span className="font-mono">{currentVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>Minimum required:</span>
            <span className="font-mono text-emerald-400">{requiredVersion}</span>
          </div>
        </div>
        
        <Button
          onClick={onUpdate}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium min-h-[44px]"
          data-testid="button-update-now"
        >
          Update Now
        </Button>
      </div>
    </div>
  );
}
