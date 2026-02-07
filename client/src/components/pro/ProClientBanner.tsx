import { useProClient } from "@/contexts/ProClientContext";
import { useLocation } from "wouter";
import { User2, LogOut } from "lucide-react";

export function ProClientBanner() {
  const { client, isProCareMode } = useProClient();
  const [, setLocation] = useLocation();

  if (!isProCareMode || !client) return null;

  return (
    <div className="bg-amber-600/90 backdrop-blur-sm border-b border-amber-400/30 px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <User2 className="h-4 w-4 text-white flex-shrink-0" />
        <span className="text-sm font-semibold text-white truncate">
          Working with: {client.name}
        </span>
      </div>
      <button
        onClick={() => setLocation("/pro/clients")}
        className="flex items-center gap-1 text-xs text-white/90 bg-black/20 rounded-lg px-2.5 py-1.5 flex-shrink-0 active:scale-[0.98] transition-transform"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>Exit Client</span>
      </button>
    </div>
  );
}
