import { useLocation } from "wouter";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { Lock } from "lucide-react";

interface UpgradeLockModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function UpgradeLockModal({ open, onClose, message }: UpgradeLockModalProps) {
  const [, setLocation] = useLocation();

  return (
    <UniversalDialog rawLayout open={open} onOpenChange={(v) => { if (!v) onClose(); }} className="sm:max-w-sm bg-black/90 backdrop-blur-2xl border-orange-500/30 text-white p-0 gap-0">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-orange-400" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed mb-6">
            {message}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { onClose(); setLocation("/pricing"); }}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              View Plans
            </button>
            <button
              onClick={onClose}
              className="w-full bg-white/10 hover:bg-white/15 text-white/70 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Maybe Later
            </button>
          </div>
        </div>
    </UniversalDialog>
  );
}
