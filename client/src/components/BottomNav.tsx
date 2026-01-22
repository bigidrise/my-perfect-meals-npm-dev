import { useLocation } from "wouter";
import { useCallback } from "react";
import { Home, CalendarDays, Sparkles, Crown } from "lucide-react";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { isGuestMode } from "@/lib/guestMode";
import {
  getGuestNavigationOverride,
  getGuestSuitePage,
} from "@/lib/guestSuiteNavigator";
import ChefEmojiButton from "@/components/chef/ChefEmojiButton";

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { open, close, isOpen, setLastResponse } = useCopilot();

  const handleNavClick = useCallback(
    (targetPath: string) => {
      if (isGuestMode()) {
        // Normalize path to remove query params before checking
        const cleanPath = location.replace(/\/+$/, "").split("?")[0];
        const currentPage = getGuestSuitePage(cleanPath);
        if (currentPage === "shopping-list" || currentPage === "biometrics") {
          const override = getGuestNavigationOverride(currentPage);
          if (override) {
            console.log(`🔒 Guest nav override: ${currentPage} → ${override}`);
            setLocation(override);
            return;
          }
        }
      }
      setLocation(targetPath);
    },
    [location, setLocation],
  );

  const normalizePath = useCallback((path: string) => {
    return path.replace(/\/+$/, "").split("?")[0];
  }, []);

  const handleChefClick = useCallback(() => {
    if (isOpen) {
      close();
      return;
    }

    const normalizedPath = normalizePath(location);
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
  }, [isOpen, open, close, location, normalizePath, setLastResponse]);

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      path: "/dashboard",
    },
    {
      id: "planner",
      label: "Planner",
      icon: CalendarDays,
      path: "/planner",
    },
    {
      id: "lifestyle",
      label: "Lifestyle",
      icon: Sparkles,
      path: "/lifestyle",
    },
    {
      id: "procare",
      label: "ProCare",
      icon: Crown,
      path: "/procare-cover",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === "/" || location === "/dashboard";
    }
    return location === path;
  };

  // Split items: first 2 on left, last 2 on right
  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2);

  return (
    <>
      {/* CHEF BUTTON - Dead-stable shell to prevent iOS viewport drift */}
      <div
        className="fixed left-1/2 z-[60] pointer-events-none"
        style={{ bottom: `calc(var(--safe-bottom) + 6px)` }}
      >
        <div
          className="pointer-events-auto"
          style={{
            transform: "translateX(-50%)",
            width: "max-content",
            backfaceVisibility: "hidden",
          }}
        >
          <ChefEmojiButton onClick={handleChefClick} />
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[var(--safe-bottom)]">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="relative h-16 grid grid-cols-[1fr_auto_1fr] items-center">
            {/* LEFT ITEMS */}
            <div className="flex items-center justify-start">
              {leftItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    style={{ flexDirection: "column" }}
                    className={`flex items-center justify-center px-4 h-full touch-manipulation transition-opacity duration-300 ${
                      active
                        ? "text-orange-500 opacity-100"
                        : "text-gray-400 opacity-60 hover:opacity-100"
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <div className="relative">
                      {active && (
                        <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                      )}
                      <Icon
                        className={`relative h-4 w-4 ${active ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                      />
                    </div>
                    <span className="text-[11px] mt-0.5 font-medium">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* CENTER SPACER - Maintains grid spacing for Chef button area */}
            <div className="w-14" aria-hidden="true" />

            {/* RIGHT ITEMS */}
            <div className="flex items-center justify-end">
              {rightItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    style={{ flexDirection: "column" }}
                    className={`flex items-center justify-center px-4 h-full touch-manipulation transition-opacity duration-300 ${
                      active
                        ? "text-orange-500 opacity-100"
                        : "text-gray-400 opacity-60 hover:opacity-100"
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <div className="relative">
                      {active && (
                        <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                      )}
                      <Icon
                        className={`relative h-4 w-4 ${active ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                      />
                    </div>
                    <span className="text-[11px] mt-0.5 font-medium">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
