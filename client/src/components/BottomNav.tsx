import { useLocation } from "wouter";
import { useCallback, useMemo } from "react";
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
import { useAuth } from "@/contexts/AuthContext";

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
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

  const showProCare = user?.role === "coach" || user?.role === "admin";

  const navItems = useMemo(() => {
    const items = [
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
    ];

    if (showProCare) {
      items.push({
        id: "procare",
        label: "ProCare",
        icon: Crown,
        path: "/procare-cover",
      });
    }

    return items;
  }, [showProCare]);

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
      {/* CHEF BUTTON - DO NOT add safe-area here, nav handles it */}
      <div
        className="fixed left-1/2 z-[45] pointer-events-none flex items-center justify-center"
        style={{ bottom: "6px", transform: "translateX(-50%)" }}
      >
        <div className="pointer-events-auto">
          <ChefEmojiButton onClick={handleChefClick} />
        </div>
      </div>

      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-xl border-t border-white/10 shadow-2xl font-size-fixed"
        style={{ paddingBottom: "var(--safe-bottom)", fontSize: "16px" }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
          <div style={{ position: "relative", height: "64px", display: "grid", gridTemplateColumns: "1fr 56px 1fr", alignItems: "center" }}>
            {/* LEFT ITEMS */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flexWrap: "nowrap" }}>
              {leftItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      padding: "0 16px",
                      height: "64px",
                      flexShrink: 0,
                    }}
                    className={`touch-manipulation ${
                      active
                        ? "text-orange-500"
                        : "text-gray-400 opacity-70"
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <div className="relative">
                      {active && (
                        <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                      )}
                      <Icon
                        style={{ width: "16px", height: "16px" }}
                        className={`relative ${active ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                      />
                    </div>
                    <span style={{ fontSize: "11px", marginTop: "2px", fontWeight: 500 }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* CENTER SPACER - Maintains grid spacing for Chef button area */}
            <div style={{ width: "56px" }} aria-hidden="true" />

            {/* RIGHT ITEMS */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "nowrap" }}>
              {rightItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      padding: "0 16px",
                      height: "64px",
                      flexShrink: 0,
                    }}
                    className={`touch-manipulation ${
                      active
                        ? "text-orange-500"
                        : "text-gray-400 opacity-70"
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <div className="relative">
                      {active && (
                        <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                      )}
                      <Icon
                        style={{ width: "16px", height: "16px" }}
                        className={`relative ${active ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                      />
                    </div>
                    <span style={{ fontSize: "11px", marginTop: "2px", fontWeight: 500 }}>
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
