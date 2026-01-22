import React, { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppRouter from "@/components/AppRouter";
import Router from "@/components/Router";
import { AvatarSelector } from "@/components/AvatarSelector";
import { ChefVoiceAssistant } from "@/components/ChefVoiceAssistant";
import { VoiceConcierge } from "@/components/VoiceConcierge";
import ScrollManager from "@/components/ScrollManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { loadRewardful } from "@/lib/rewardful";
import { AudioProvider } from "@/audio/AudioProvider";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { ForcedUpdateModal } from "@/components/ForcedUpdateModal";
import { updateApp } from "@/lib/updateApp";
import { CopilotSystem } from "@/components/copilot/CopilotSystem";
import type { CopilotAction } from "@/components/copilot/CopilotContext";
import { setNavigationHandler, setModalHandler } from "@/components/copilot/CopilotCommandRegistry";
import { useLocation } from "wouter";
import { initNativeDemoMode } from "@/lib/auth";
import { RootViewport } from "./layouts/RootViewport";
import { setupNotificationListeners } from "@/services/mealReminderService";
import DevBadge from "./components/DevBadge";
import { Capacitor } from "@capacitor/core";
import { UpdateManagerProvider } from "@/contexts/UpdateManagerContext";
import { GlobalUpdateBanner } from "@/components/GlobalUpdateBanner";

// Initialize native demo mode BEFORE React renders (for iOS preview recording)
initNativeDemoMode();

// iOS Native Safe Area Override
// When running in iOS native shell, iOS already handles safe areas.
// Set CSS variables to 0 to prevent double safe-area padding.
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
  document.documentElement.style.setProperty("--safe-top", "0px");
  document.documentElement.style.setProperty("--safe-bottom", "0px");
  document.documentElement.style.setProperty("--safe-left", "0px");
  document.documentElement.style.setProperty("--safe-right", "0px");
}



export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const { versionState } = useVersionCheck();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setNavigationHandler((path) => {
      console.log("🧭 Copilot navigating to:", path);
      setLocation(path);
    });

    setModalHandler((modalId) => {
      console.log("🪟 Copilot opening modal:", modalId);
    });
  }, [setLocation]);

  // Setup meal reminder notification tap handler
  useEffect(() => {
    const cleanup = setupNotificationListeners((route) => {
      console.log("🔔 Notification tap, navigating to:", route);
      setLocation(route);
    });
    return cleanup;
  }, [setLocation]);

  useEffect(() => {
    // Quick app readiness check
    const timer = setTimeout(() => setIsAppReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Load Rewardful affiliate tracking
    const key = import.meta.env.VITE_REWARDFUL_PUBLIC_KEY as string;
    if (key) {
      loadRewardful(key);
    }
  }, []);

  // Handle update action
  const handleUpdate = () => {
    updateApp();
  };

  const handleCopilotAction = (action: CopilotAction) => {
    switch (action.type) {
      case "navigate":
        if (action.to) {
          setLocation(action.to);
        }
        break;
      case "open-modal":
        console.log("[Copilot] Open modal:", action.id);
        // Hook into modal system when needed
        break;
      case "run-command":
        console.log("[Copilot] Run command:", action.id);
        // Hook into command bus when needed
        break;
      case "custom":
        console.log("[Copilot] Custom action:", action.payload);
        break;
    }
  };

  if (!isAppReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/80 text-sm">Loading My Perfect Meals...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <DevBadge />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <UpdateManagerProvider>
              <AudioProvider>
                <ScrollManager />

                {/* Global Update Banner - BIG-APP PATTERN: User-controlled updates */}
                <GlobalUpdateBanner />

                {/* Forced Update Modal (blocks app access if version too old) */}
                {versionState?.forceUpdate && versionState.remoteInfo && (
                  <ForcedUpdateModal
                    currentVersion={versionState.currentVersion}
                    requiredVersion={versionState.remoteInfo.minSupported}
                    onUpdate={handleUpdate}
                  />
                )}

                <CopilotSystem onAction={handleCopilotAction}>
                  <RootViewport>
                    <AppRouter>
                      <Router />
                    </AppRouter>
                  </RootViewport>
                  <AvatarSelector />
                  <ChefVoiceAssistant />
                  <VoiceConcierge />
                  <Toaster />
                </CopilotSystem>
              </AudioProvider>
            </UpdateManagerProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}