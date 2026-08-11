import { useProClient } from "@/contexts/ProClientContext";
import { useLocation } from "wouter";
import { User2, LogOut, ChevronLeft } from "lucide-react";

export interface ProtocolBadge {
  label: string;
  cls: string;
}

interface BuilderHeaderProps {
  title: string;
  onOpenTour: () => void;
  clientId?: string | null;
  protocols?: ProtocolBadge[];
  backTo?: string;
  backLabel?: string;
}

export function BuilderHeader({ title, onOpenTour, clientId, protocols, backTo, backLabel }: BuilderHeaderProps) {
  const { client, isProCareMode } = useProClient();
  const [, setLocation] = useLocation();

  const isInStudioClientContext = isProCareMode && !!client && !!clientId;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-black/40 via-orange-600/40 to-black/40 backdrop-blur-lg border-b border-white/10"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-nowrap overflow-hidden">
          {backTo && !isInStudioClientContext && (
            <button
              onClick={() => setLocation(backTo)}
              className="flex items-center gap-1 text-white/80 active:text-white transition-colors flex-shrink-0 -ml-1 pr-1"
              aria-label={`Back to ${backLabel ?? "Hub"}`}
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">{backLabel ?? "Hub"}</span>
            </button>
          )}
          <h1 className="text-lg font-bold text-white flex-1 min-w-0 truncate">
            {title}
          </h1>
        </div>

        {isInStudioClientContext && (
          <div className="bg-amber-600/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User2 className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-sm font-semibold text-white truncate">
                Working with: {client.name}
              </span>
            </div>
            <button
              onClick={() => setLocation(`/pro/clients/${clientId}`)}
              className="flex items-center gap-1 text-xs text-white/90 bg-black/20 rounded-lg px-2.5 py-1.5 flex-shrink-0 active:scale-[0.98] transition-transform"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Client</span>
            </button>
          </div>
        )}

        {/* Active Protocol row intentionally omitted on mobile — too tall, not enough screen space */}
      </div>
    </div>
  );
}
