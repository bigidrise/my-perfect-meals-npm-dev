import { useLocation } from "wouter";
import { useCallback } from "react";
import { Home, CalendarDays, Sparkles, Crown } from "lucide-react";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { ChefCapIcon } from "@/components/copilot/ChefCapIcon";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { motion } from "framer-motion";
import { isGuestMode } from "@/lib/guestMode";
import { getGuestNavigationOverride, getGuestSuitePage } from "@/lib/guestSuiteNavigator";

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { open, close, isOpen, setLastResponse } = useCopilot();
  
  const handleNavClick = useCallback((targetPath: string) => {
    if (isGuestMode()) {
      // Normalize path to remove query params before checking
      const cleanPath = location.replace(/\/+$/, '').split('?')[0];
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
  }, [location, setLocation]);
  
  const normalizePath = useCallback((path: string) => {
    return path.replace(/\/+$/, '').split('?')[0];
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="relative h-12 flex items-center justify-between">
          {/* LEFT ITEMS */}
          <div className="flex items-center justify-start flex-1">
            {leftItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  style={{ flexDirection: "column" }}
                  className={`flex items-center justify-center px-4 h-full transition-all duration-300 ${
                    active
                      ? "text-orange-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <div className={`relative ${active ? "animate-pulse" : ""}`}>
                    {active && (
                      <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                    )}
                    <Icon
                      className={`relative h-4 w-4 transition-all duration-300 ${active ? "scale-95 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                    />
                  </div>
                  <span
                    className={`text-[11px] mt-0.5 font-medium transition-all duration-300 ${active ? "font-bold text-orange-500" : ""}`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CENTER COPILOT BUTTON */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 z-10">
            <motion.button
              onClick={handleChefClick}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-all duration-300"
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -2, scale: 1.08 }}
              style={{
                boxShadow:
                  "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
              }}
            >
              <ChefCapIcon size={54} />
            </motion.button>
          </div>

          {/* RIGHT ITEMS */}
          <div className="flex items-center justify-end flex-1">
            {rightItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  style={{ flexDirection: "column" }}
                  className={`flex items-center justify-center px-4 h-full transition-all duration-300 ${
                    active
                      ? "text-orange-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <div className={`relative ${active ? "animate-pulse" : ""}`}>
                    {active && (
                      <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full"></div>
                    )}
                    <Icon
                      className={`relative h-4 w-4 transition-all duration-300 ${active ? "scale-95 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : ""}`}
                    />
                  </div>
                  <span
                    className={`text-[11px] mt-0.5 font-medium transition-all duration-300 ${active ? "font-bold text-orange-500" : ""}`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
