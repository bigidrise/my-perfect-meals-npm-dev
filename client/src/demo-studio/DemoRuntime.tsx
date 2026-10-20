import React, { useSyncExternalStore, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { IsolatedDemoAuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { HouseholdProvider } from "@/contexts/HouseholdContext";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { NarrationSpeedProvider } from "@/contexts/NarrationSpeedContext";
import { AudioProvider } from "@/audio/AudioProvider";
import { VoiceProvider } from "@/voice/VoiceProvider";
import { ProClientProvider } from "@/contexts/ProClientContext";
import { PageTitleProvider } from "@/contexts/PageTitleContext";
import { UpgradeModalProvider } from "@/contexts/UpgradeModalContext";
import { CopilotProvider } from "@/components/copilot/CopilotContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { RootViewport } from "@/layouts/RootViewport";
import OnboardingV3 from "@/pages/OnboardingV3";
import MacroCalculator from "@/pages/MacroCalculator";
import DashboardNew from "@/pages/DashboardNew";
import StudioControls from "./StudioControls";
import { type DemoStore, type DemoWorkflow, workflowPath } from "./state";
import { assertIsolatedDemoRuntime } from "./runtimeAuthority";

class DemoErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    return this.state.error ? <div role="alert" className="p-8 text-red-300">
      This screen stopped safely. No live API fallback was attempted.<pre>{this.state.error}</pre>
    </div> : this.props.children;
  }
}

export function mountDemo(store: DemoStore) {
  assertIsolatedDemoRuntime();
  // This queryClient singleton exists exclusively inside this separate bundled
  // JavaScript realm. No QueryClient, module instance, or cache crosses the frame.
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  const useDemoLocation = () => {
    useSyncExternalStore(store.subscribe, () => store.revision);
    return [store.state.path.split("?")[0], store.navigate] as [string, typeof store.navigate];
  };
  function Runtime() {
    useSyncExternalStore(store.subscribe, () => store.revision);
    const [epoch, setEpoch] = useState(0);
    const state = store.state;
    const onChange = useCallback((user: typeof state.user) => store.patchUser(user), []);
    const navigate = (workflow: DemoWorkflow) => store.navigate(workflowPath(workflow));
    const reset = (workflow: DemoWorkflow | null) => {
      queryClient.clear(); store.reset(workflow); setEpoch(v => v + 1);
      window.dispatchEvent(new Event("mpm:targetsUpdated"));
    };
    return <StudioControls workflow={state.workflow}
      name={`${state.user.firstName} ${state.user.lastName}`.trim()}
      calories={state.targets?.calories ?? 0}
      onNavigate={navigate} onStartFresh={reset}
      onResetCurrent={() => reset(state.workflow)} onResetAll={() => reset(null)}
      onReturn={() => store.navigate("/")} blockedRequests={[...store.blocked]}>
      <p className="bg-amber-950/70 text-amber-100 text-xs px-4 py-2" role="note">
        Synthetic walkthrough only. Calculations are illustrative, not clinical guidance.
        Live AI, billing, communication, uploads, and modules outside Phase 1 are unavailable.
      </p>
      <div key={epoch}>
        <DemoErrorBoundary>
          <Router hook={useDemoLocation}>
            <QueryClientProvider client={queryClient}><TooltipProvider>
              <IsolatedDemoAuthProvider user={state.user} onChange={onChange} readUser={() => store.state.user}>
                <OrgProvider><HouseholdProvider><FontSizeProvider><NarrationSpeedProvider>
                  <AudioProvider><VoiceProvider><CopilotProvider onAction={action => {
                    if (action.type === "navigate") store.navigate(action.to);
                  }}><UpgradeModalProvider><ProClientProvider><PageTitleProvider>
                    <RootViewport>
                      {state.workflow === "onboarding" && <OnboardingV3 />}
                      {state.workflow === "macro" && <MacroCalculator />}
                      {state.workflow === "dashboard" && <DashboardNew />}
                    </RootViewport>
                    <Toaster />
                  </PageTitleProvider></ProClientProvider></UpgradeModalProvider></CopilotProvider>
                  </VoiceProvider></AudioProvider>
                </NarrationSpeedProvider></FontSizeProvider></HouseholdProvider></OrgProvider>
              </IsolatedDemoAuthProvider>
            </TooltipProvider></QueryClientProvider>
          </Router>
        </DemoErrorBoundary>
      </div>
    </StudioControls>;
  }
  createRoot(document.getElementById("root")!).render(<Runtime />);
}
