import { ReactNode, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import DesktopHeader from "./DesktopHeader";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { isGuestMode } from "@/lib/guestMode";
import ChefEmojiButton from "@/components/chef/ChefEmojiButton";
import {
  LayoutDashboard,
  Calendar,
  ChefHat,
  MoreHorizontal,
  Home,
  Briefcase,
} from "lucide-react";

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
  { path: "/planner", label: "Planner", icon: Calendar },
  { path: "/lifestyle", label: "Lifestyle", icon: ChefHat },
  { path: "/more", label: "More", icon: MoreHorizontal },
];

export default function DesktopLayout({ children }: Props) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);
  const { open, close, isOpen, setLastResponse } = useCopilot();

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

  const isProfessional =
    user?.professionalRole === "physician" ||
    user?.professionalRole === "trainer";

  const isOnProRoute =
    location.startsWith("/care-team/") ||
    location.startsWith("/pro/");

  const activeSpace = isOnProRoute
    ? "workspace"
    : typeof window !== "undefined"
    ? localStorage.getItem("mpm_active_space")
    : null;

  const handleWorkspaceChoice = (choice: "personal" | "workspace") => {
    setShowWorkspaceChooser(false);

    if (choice === "workspace") {
      localStorage.setItem("mpm_active_space", "workspace");

      const route =
        user?.professionalRole === "physician"
          ? "/care-team/physician"
          : "/care-team/trainer";

      setLocation(route);
    } else {
      localStorage.setItem("mpm_active_space", "personal");
      sessionStorage.removeItem("mpm.welcomeGateDone");
      setLocation("/dashboard");
    }
  };

  const handlePersonalSpace = () => {
    localStorage.setItem("mpm_active_space", "personal");
    sessionStorage.removeItem("mpm.welcomeGateDone");
    setLocation("/dashboard");
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">

      <aside className="w-60 shrink-0 bg-black border-r border-white/10 flex flex-col overflow-y-auto">

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

        <nav className="flex-1 px-3 space-y-1">

          {navItems.map(({ path, label, icon: Icon }) => {

            const active =
              location === path ||
              location.startsWith(path + "/");

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

            <button
              onClick={handlePersonalSpace}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSpace === "personal" || !activeSpace
                  ? "bg-emerald-500/15 text-emerald-400 font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              Personal Space
            </button>

            <button
              onClick={() => setShowWorkspaceChooser(true)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSpace === "workspace"
                  ? "bg-orange-500/15 text-orange-400 font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              Professional Workspace
            </button>

          </div>
        )}

      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <DesktopHeader />
        <main className="flex-1 overflow-y-auto px-6 py-6 desktop-content">
          {children}
        </main>
      </div>

      {showWorkspaceChooser && (
        <WorkspaceChooser onChoose={handleWorkspaceChoice} />
      )}

    </div>
  );
}
