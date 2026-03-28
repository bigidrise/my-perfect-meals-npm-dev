import { useState } from "react";
import { useLocation } from "wouter";
import { Users, LayoutDashboard, ArrowLeftRight } from "lucide-react";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { useAuth } from "@/contexts/AuthContext";
import { useProUnreadCount } from "@/hooks/useProUnreadCount";

export default function StudioBottomNav() {
  const [location, setLocation] = useLocation();
  const [showChooser, setShowChooser] = useState(false);
  const { user } = useAuth();
  const totalUnread = useProUnreadCount();

  const isPhysician = user?.professionalRole === "physician";
  const careTeamRoute = isPhysician ? "/care-team/physician" : "/care-team/trainer";
  const portalRoute = isPhysician ? "/pro/physician-clients" : "/pro/clients";

  const isActive = (path: string) => location.startsWith(path);

  return (
    <>
      {showChooser && (
        <WorkspaceChooser
          onChoose={(choice) => {
            setShowChooser(false);
            if (choice === "personal") {
              localStorage.setItem("mpm_active_space", "personal");
              sessionStorage.removeItem("mpm.welcomeGateDone");
              if (!user?.onboardingCompletedAt) {
                setLocation("/consumer-welcome");
              } else {
                setLocation("/");
              }
            } else {
              localStorage.setItem("mpm_active_space", "workspace");
            }
          }}
        />
      )}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation(careTeamRoute)}
              className={`flex flex-col items-center text-xs ${
                isActive("/care-team") ? "text-orange-500" : "text-white/60"
              }`}
            >
              <Users className="h-4 w-4 mb-1" />
              Care Team
            </button>

            <button
              onClick={() => setLocation(portalRoute)}
              className={`flex flex-col items-center text-xs ${
                isActive("/pro") ? "text-orange-500" : "text-white/60"
              }`}
            >
              <div className="relative mb-1">
                <LayoutDashboard className="h-4 w-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                  </span>
                )}
              </div>
              Pro Portal
            </button>

            <button
              onClick={() => setShowChooser(true)}
              className="flex flex-col items-center text-xs text-white/60"
            >
              <ArrowLeftRight className="h-4 w-4 mb-1" />
              Switch
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
