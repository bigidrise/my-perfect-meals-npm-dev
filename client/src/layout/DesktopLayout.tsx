import { ReactNode, useCallback, useState } from "react";
import { Link, useLocation } from "wouter";
import DesktopHeader from "./DesktopHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { isGuestMode } from "@/lib/guestMode";
import ChefEmojiButton from "@/components/chef/ChefEmojiButton";
import { DesktopLayoutProvider } from "@/contexts/DesktopLayoutContext";
import {
  LayoutDashboard,
  Calendar,
  ChefHat,
  MoreHorizontal,
  Home,
  Users,
  FolderOpen,
  Briefcase,
} from "lucide-react";
import { useProUnreadCount } from "@/hooks/useProUnreadCount";

interface Props {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: any;
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/builders", label: "Builders", icon: Calendar },
  { path: "/lifestyle", label: "Lifestyle", icon: ChefHat },
  { path: "/more", label: "More", icon: MoreHorizontal },
];

type WorkspaceMode = "personal" | "studio";

function getInitialWorkspaceMode(location: string): WorkspaceMode {
  const isOnProRoute =
    location.startsWith("/care-team/") || location.startsWith("/pro/");
  if (isOnProRoute) return "studio";
  const stored =
    typeof window !== "undefined"
      ? localStorage.getItem("mpm_active_space")
      : null;
  return stored === "workspace" ? "studio" : "personal";
}

export default function DesktopLayout({ children }: Props) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { open, close, isOpen, setLastResponse } = useCopilot();

  const isProfessional =
    user?.professionalRole === "physician" ||
    user?.professionalRole === "trainer";

  const proUnreadCount = useProUnreadCount();

  const isOnProRoute =
    location.startsWith("/care-team/") || location.startsWith("/pro/");

  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>(() =>
    getInitialWorkspaceMode(location),
  );

  const currentMode: WorkspaceMode = !isProfessional
    ? "personal"
    : isOnProRoute
      ? "studio"
      : workspaceMode;
  const isStudioActive = currentMode === "studio";
  const isPersonalActive = currentMode === "personal";

  const isOnPersonalRoute =
    location.startsWith("/dashboard") ||
    location.startsWith("/builders") ||
    location.startsWith("/lifestyle") ||
    location.startsWith("/more");

  const setWorkspaceMode = (mode: WorkspaceMode) => {
    setWorkspaceModeState(mode);
    if (mode === "studio") {
      localStorage.setItem("mpm_active_space", "workspace");
    } else {
      localStorage.setItem("mpm_active_space", "personal");
    }
  };

  const handleChefClick = useCallback(() => {
    if (isOpen) {
      close();
      return;
    }

    const normalizedPath = location.replace(/\/+$/, "").split("?")[0];
    const explanation = getGuestPageExplanation(normalizedPath, isGuestMode());

    CopilotExplanationStore.resetPath(normalizedPath);

    open();

    if (explanation) {
      setTimeout(() => {
        setLastResponse({
          title: explanation.title,
          description: explanation.description,
          spokenText: explanation.spokenText,
          autoClose: false,
        });
      }, 300);
    }
  }, [isOpen, open, close, location, setLastResponse]);

  const handlePersonalSpace = () => {
    setWorkspaceMode("personal");
    sessionStorage.removeItem("mpm.welcomeGateDone");
    if (!user?.onboardingCompletedAt) {
      setLocation("/consumer-welcome");
    } else {
      setLocation("/dashboard");
    }
  };

  const handleStudioSpace = () => {
    setWorkspaceMode("studio");
    setLocation(
      user?.professionalRole === "physician"
        ? "/care-team/physician"
        : "/care-team/trainer",
    );
  };

  return (
    <DesktopLayoutProvider value={true}>
      <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
        <aside
          className={`w-60 shrink-0 border-r border-white/10 flex flex-col overflow-y-auto transition-colors duration-300 pb-20 ${
            isStudioActive ? "bg-[rgba(30,90,180,0.06)]" : "bg-black"
          }`}
        >
          <div className="px-5 pt-5 pb-4">
            <button
              onClick={handleChefClick}
              className="flex items-center justify-center gap-2 w-full pb-3 group"
            >
              <ChefEmojiButton onClick={handleChefClick} size={40} />
              <span className="text-sm font-medium text-white/60 group-hover:text-orange-400 transition-colors">
                Ask Chef
              </span>
            </button>
            <div className="text-lg font-bold tracking-tight text-center">
              My Perfect Meals
            </div>
            <div className="text-[11px] text-white/40 mt-0.5 text-center">
              Coach in Your Pocket
            </div>
          </div>

          {isProfessional && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Workspace /
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isStudioActive ? "text-blue-400" : "text-emerald-400"
                  }`}
                >
                  {isStudioActive ? "Studio" : "Personal"}
                </span>
              </div>
            </div>
          )}

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const active =
                location === path || location.startsWith(path + "/");

              if (isStudioActive) {
                return (
                  <div
                    key={path}
                    aria-disabled="true"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/25 cursor-not-allowed"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </div>
                );
              }

              return (
                <Link
                  key={path}
                  href={path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-orange-500/15 text-orange-400 font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {isProfessional && (
            <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-1">
              <div className="px-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Workspaces
                </span>
              </div>

              <button
                onClick={handlePersonalSpace}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isPersonalActive
                    ? "bg-emerald-500/15 text-emerald-400 font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                Personal Space
              </button>

              <button
                onClick={handleStudioSpace}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isStudioActive
                    ? "bg-blue-500/15 text-blue-400 font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                Studio Workspace
              </button>

              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Studio Tools
                </span>
              </div>

              {isPersonalActive ? (
                <>
                  <div
                    aria-disabled="true"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/25 cursor-not-allowed"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    Care Team
                  </div>

                  <div
                    aria-disabled="true"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/25 cursor-not-allowed"
                  >
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    Pro Portal
                    {proUnreadCount > 0 && (
                      <span className="ml-auto flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      localStorage.setItem("mpm_active_space", "workspace");
                      setLocation(
                        user?.professionalRole === "physician"
                          ? "/care-team/physician"
                          : "/care-team/trainer",
                      );
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      location.startsWith("/care-team")
                        ? "bg-orange-500/15 text-orange-400 font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    Care Team
                  </button>

                  <button
                    onClick={() => {
                      localStorage.setItem("mpm_active_space", "workspace");
                      setLocation(
                        user?.professionalRole === "physician"
                          ? "/pro/physician-clients"
                          : "/pro/clients",
                      );
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      location.startsWith("/pro/")
                        ? "bg-orange-500/15 text-orange-400 font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    Pro Portal
                    {proUnreadCount > 0 && (
                      <span className="ml-auto flex h-2.5 w-2.5 shrink-0 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <DesktopHeader />
          <div className="relative flex-1 overflow-hidden">
            <main className="h-full overflow-y-auto px-6 py-6 desktop-content">
              <div className="desktop-page-reset">{children}</div>
            </main>
            {isStudioActive && isOnPersonalRoute && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] z-10 pointer-events-auto" />
            )}
          </div>
        </div>
      </div>
    </DesktopLayoutProvider>
  );
}
