import { useState } from "react";
import { useLocation } from "wouter";
import { Users, LayoutDashboard, ArrowLeftRight } from "lucide-react";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";

export default function StudioBottomNav() {
  const [location, setLocation] = useLocation();
  const [showChooser, setShowChooser] = useState(false);

  const isActive = (path: string) => location.startsWith(path);

  return (
    <>
      {showChooser && (
        <WorkspaceChooser
          onChoose={(choice) => {
            setShowChooser(false);
            if (choice === "personal") {
              localStorage.setItem("coachMode", "self");
              setLocation("/dashboard");
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
              onClick={() => setLocation("/care-team")}
              className={`flex flex-col items-center text-xs ${
                isActive("/care-team") ? "text-orange-500" : "text-white/60"
              }`}
            >
              <Users className="h-4 w-4 mb-1" />
              Care Team
            </button>

            <button
              onClick={() => setLocation("/pro-portal")}
              className={`flex flex-col items-center text-xs ${
                isActive("/pro-portal") ? "text-orange-500" : "text-white/60"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 mb-1" />
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
