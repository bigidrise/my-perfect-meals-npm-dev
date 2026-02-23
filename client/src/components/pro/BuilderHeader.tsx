import { useProClient } from "@/contexts/ProClientContext";
import { useLocation } from "wouter";
import { Info, User2, LogOut } from "lucide-react";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { QuickTourButton } from "@/components/guided/QuickTourButton";

interface BuilderHeaderProps {
  title: string;
  onOpenTour: () => void;
  clientId?: string | null;
}

export function BuilderHeader({ title, onOpenTour, clientId }: BuilderHeaderProps) {
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
          <h1 className="text-lg font-bold text-white flex-1 min-w-0 truncate">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <MedicalSourcesInfo asPillButton />
            <QuickTourButton onClick={onOpenTour} />
          </div>
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
      </div>
    </div>
  );
}
