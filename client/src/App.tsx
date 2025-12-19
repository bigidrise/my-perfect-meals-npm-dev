import React, { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppRouter from "@/components/AppRouter";
import Router from "@/components/Router";
// Biometric imports moved to Router.tsx to prevent circular dependencies
import { AvatarSelector } from "@/components/AvatarSelector";
import { ChefVoiceAssistant } from "@/components/ChefVoiceAssistant";
import { VoiceConcierge } from "@/components/VoiceConcierge";
import ScrollManager from "@/components/ScrollManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { loadRewardful } from "@/lib/rewardful";
import { AudioProvider } from "@/audio/AudioProvider";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { UpdateBanner } from "@/components/UpdateBanner";
import { ForcedUpdateModal } from "@/components/ForcedUpdateModal";
import { updateApp } from "@/lib/updateApp";
import { CopilotSystem } from "@/components/copilot/CopilotSystem";
import type { CopilotAction } from "@/components/copilot/CopilotContext";
import { setNavigationHandler, setModalHandler } from "@/components/copilot/CopilotCommandRegistry";
import { useLocation } from "wouter";
import { TourProvider } from "./contexts/TourContext";
import { MobileVoiceHandler } from "./components/MobileVoiceHandler";
import { OnboardingFooter } from "./components/OnboardingFooter";
import { CopilotProvider } from "./components/copilot/CopilotContext";
import { initNativeDemoMode } from "@/lib/auth";
import RootViewport from "./components/RootViewport";

// Initialize native demo mode BEFORE React renders (for iOS preview recording)
initNativeDemoMode();



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
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AudioProvider>
              <ScrollManager />

              {/* Forced Update Modal (blocks app access if version too old) */}
              {versionState?.forceUpdate && versionState.remoteInfo && (
                <ForcedUpdateModal
                  currentVersion={versionState.currentVersion}
                  requiredVersion={versionState.remoteInfo.minSupported}
                  onUpdate={handleUpdate}
                />
              )}

              {/* Update Banner removed - focus event auto-reload handles updates */}
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
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}