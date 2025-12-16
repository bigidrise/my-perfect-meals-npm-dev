/**
 * @deprecated DEPRECATED - November 30, 2025
 * 
 * This hook is deprecated due to stability issues and complexity.
 * Use the new Quick Tour system instead:
 * 
 * import { useQuickTour } from "@/hooks/useQuickTour";
 * import { QuickTourModal } from "@/components/guided/QuickTourModal";
 * import { QuickTourButton } from "@/components/guided/QuickTourButton";
 * 
 * See LOCKDOWN.md "WALKTHROUGH SYSTEM" section for details.
 * 
 * DO NOT USE THIS HOOK IN NEW CODE.
 */
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCopilotGuidedMode } from '@/components/copilot/CopilotGuidedModeContext';
import { useCopilot } from '@/components/copilot/CopilotContext';
import { getWalkthroughConfig, getPageScript } from '@/components/copilot/WalkthroughRegistry';
import { flowOrchestrator } from '@/components/copilot/FlowOrchestrator';
import { startSimpleWalkthrough } from '@/components/copilot/simple-walkthrough/simpleWalkthroughHelper';
import { getPageSegment } from '@/components/copilot/simple-walkthrough/simpleWalkthroughFlows';

/** @deprecated Use useQuickTour instead */
export function usePageWalkthrough(scriptId?: string) {
  const [location, setLocation] = useLocation();
  const { isGuidedModeEnabled } = useCopilotGuidedMode();
  const { open } = useCopilot();

  useEffect(() => {
    flowOrchestrator.setNavigationCallback((path: string) => {
      setLocation(path);
    });

    const handleFlowNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      setLocation(customEvent.detail.path);
    };

    window.addEventListener('flow-navigate', handleFlowNavigate);
    return () => {
      window.removeEventListener('flow-navigate', handleFlowNavigate);
      flowOrchestrator.clearNavigationCallback();
    };
  }, [setLocation]);

  useEffect(() => {
    if (!isGuidedModeEnabled) return;

    const config = getWalkthroughConfig(location);
    if (!config) return;

    const delay = config.autoStartDelay || 500;

    const timeoutId = setTimeout(() => {
      open();

      setTimeout(() => {
        if (config.mode === 'flow' && config.flowId) {
          flowOrchestrator.startFlowIfNeeded(location);
          
          const pageSegment = getPageSegment(config.flowId, location);
          if (pageSegment && pageSegment.steps) {
            startSimpleWalkthrough(pageSegment.pageId, pageSegment.steps);
          }
        } else if (config.mode === 'page' && config.scriptId) {
          const script = getPageScript(config.scriptId);
          if (script) {
            startSimpleWalkthrough(config.scriptId, script);
          }
        }
      }, 3000);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [location, isGuidedModeEnabled, scriptId, open]);

  useEffect(() => {
    const handleGuidedModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (!customEvent.detail.enabled) return;

      const config = getWalkthroughConfig(location);
      if (!config) return;
      
      open();
      setTimeout(() => {
        if (config.mode === 'flow' && config.flowId) {
          flowOrchestrator.startFlowIfNeeded(location);
          
          const pageSegment = getPageSegment(config.flowId, location);
          if (pageSegment && pageSegment.steps) {
            startSimpleWalkthrough(pageSegment.pageId, pageSegment.steps);
          }
        } else if (config.mode === 'page' && config.scriptId) {
          const script = getPageScript(config.scriptId);
          if (script) {
            startSimpleWalkthrough(config.scriptId, script);
          }
        }
      }, 3000);
    };

    window.addEventListener('copilot-guided-mode-changed', handleGuidedModeChange);
    return () => window.removeEventListener('copilot-guided-mode-changed', handleGuidedModeChange);
  }, [location, open]);
}
