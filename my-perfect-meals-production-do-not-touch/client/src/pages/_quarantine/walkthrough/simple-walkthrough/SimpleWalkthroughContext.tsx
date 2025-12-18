import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getFlowById, getPageSegment, getNextPageSegment, type WalkthroughFlow, type PageSegment } from "./simpleWalkthroughFlows";

interface SimpleStep {
  selector: string;
  text?: string;
  showArrow?: boolean;
}

interface FlowProgress {
  flowId: string;
  currentPageIndex: number;
  completedPages: string[];
}

interface SimpleWalkthroughState {
  activeScript: string | null;
  currentStepIndex: number;
  currentStep: SimpleStep | null;
  isActive: boolean;
  activeFlowId: string | null;
  currentPageIndex: number;
}

interface SimpleWalkthroughContextValue {
  state: SimpleWalkthroughState;
  startWalkthrough: (scriptId: string, steps: SimpleStep[]) => void;
  startFlow: (flowId: string) => void;
  nextStep: () => void;
  advanceToNextPage: () => void;
  skipWalkthrough: () => void;
  cancelWalkthrough: () => void;
  clearFlow: () => void;
  getCurrentPageSegment: () => PageSegment | undefined;
  triggerCompletionEvent: (eventName: string) => void;
}

const STORAGE_KEY = 'simple_walkthrough_flow_progress';

const SimpleWalkthroughContext = createContext<SimpleWalkthroughContextValue | null>(null);

function loadFlowProgress(): FlowProgress | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[SimpleWalkthrough] Failed to load flow progress:', e);
  }
  return null;
}

function saveFlowProgress(progress: FlowProgress | null) {
  try {
    if (progress) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[SimpleWalkthrough] Failed to save flow progress:', e);
  }
}

export function SimpleWalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [activeScript, setActiveScript] = useState<string | null>(null);
  const [steps, setSteps] = useState<SimpleStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completedPages, setCompletedPages] = useState<string[]>([]);

  const state: SimpleWalkthroughState = {
    activeScript,
    currentStepIndex,
    currentStep: steps[currentStepIndex] || null,
    isActive: activeScript !== null && currentStepIndex < steps.length,
    activeFlowId,
    currentPageIndex,
  };

  const startWalkthrough = useCallback((scriptId: string, scriptSteps: SimpleStep[]) => {
    console.log("[SimpleWalkthrough] Starting:", scriptId, "with", scriptSteps.length, "steps");
    setActiveScript(scriptId);
    setSteps(scriptSteps);
    setCurrentStepIndex(0);
  }, []);

  const startFlow = useCallback((flowId: string) => {
    console.log("[SimpleWalkthrough] Starting flow:", flowId);
    const flow = getFlowById(flowId);
    if (!flow) {
      console.warn("[SimpleWalkthrough] Flow not found:", flowId);
      return;
    }
    
    setActiveFlowId(flowId);
    setCurrentPageIndex(0);
    setCompletedPages([]);
    
    saveFlowProgress({
      flowId,
      currentPageIndex: 0,
      completedPages: []
    });
    
    // Navigate to the first page of the flow
    const firstPage = flow.pages[0];
    if (firstPage && window.location.pathname !== firstPage.route) {
      console.log("[SimpleWalkthrough] Navigating to first page:", firstPage.route);
      window.location.href = firstPage.route;
    }
  }, []);

  const nextStep = useCallback(() => {
    console.log("[SimpleWalkthrough] Next step:", currentStepIndex + 1);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      console.log("[SimpleWalkthrough] Page completed");
      setActiveScript(null);
      setSteps([]);
      setCurrentStepIndex(0);
    }
  }, [currentStepIndex, steps.length]);

  const advanceToNextPage = useCallback(() => {
    if (!activeFlowId) return;
    
    const flow = getFlowById(activeFlowId);
    if (!flow) return;
    
    const currentPage = flow.pages[currentPageIndex];
    const nextIndex = currentPageIndex + 1;
    
    if (nextIndex >= flow.pages.length) {
      console.log("[SimpleWalkthrough] Flow completed!");
      setActiveFlowId(null);
      setCurrentPageIndex(0);
      setCompletedPages([]);
      setActiveScript(null);
      setSteps([]);
      setCurrentStepIndex(0);
      saveFlowProgress(null);
      return;
    }
    
    const newCompleted = [...completedPages, currentPage.pageId];
    const nextPage = flow.pages[nextIndex];
    
    console.log("[SimpleWalkthrough] Advancing to page:", nextIndex, nextPage.pageId);
    setCurrentPageIndex(nextIndex);
    setCompletedPages(newCompleted);
    setActiveScript(null);
    setSteps([]);
    setCurrentStepIndex(0);
    
    saveFlowProgress({
      flowId: activeFlowId,
      currentPageIndex: nextIndex,
      completedPages: newCompleted
    });
    
    // Auto-navigate to the next page
    if (currentPage.autoNavigate && nextPage && window.location.pathname !== nextPage.route) {
      console.log("[SimpleWalkthrough] Auto-navigating to:", nextPage.route);
      setTimeout(() => {
        window.location.href = nextPage.route;
      }, 500);
    }
  }, [activeFlowId, currentPageIndex, completedPages]);

  const getCurrentPageSegment = useCallback((): PageSegment | undefined => {
    if (!activeFlowId) return undefined;
    const flow = getFlowById(activeFlowId);
    if (!flow || currentPageIndex >= flow.pages.length) return undefined;
    return flow.pages[currentPageIndex];
  }, [activeFlowId, currentPageIndex]);

  const triggerCompletionEvent = useCallback((eventName: string) => {
    const currentPage = getCurrentPageSegment();
    if (currentPage && currentPage.completionEvent === eventName) {
      console.log("[SimpleWalkthrough] Completion event triggered:", eventName);
      advanceToNextPage();
    }
  }, [getCurrentPageSegment, advanceToNextPage]);

  const skipWalkthrough = useCallback(() => {
    console.log("[SimpleWalkthrough] Skipped");
    setActiveScript(null);
    setSteps([]);
    setCurrentStepIndex(0);
  }, []);

  const cancelWalkthrough = useCallback(() => {
    console.log("[SimpleWalkthrough] Cancelled");
    setActiveScript(null);
    setSteps([]);
    setCurrentStepIndex(0);
  }, []);

  const clearFlow = useCallback(() => {
    console.log("[SimpleWalkthrough] Flow cleared");
    setActiveFlowId(null);
    setCurrentPageIndex(0);
    setCompletedPages([]);
    setActiveScript(null);
    setSteps([]);
    setCurrentStepIndex(0);
    saveFlowProgress(null);
  }, []);

  useEffect(() => {
    const savedProgress = loadFlowProgress();
    if (savedProgress) {
      console.log("[SimpleWalkthrough] Restoring flow progress:", savedProgress);
      setActiveFlowId(savedProgress.flowId);
      setCurrentPageIndex(savedProgress.currentPageIndex);
      setCompletedPages(savedProgress.completedPages);
    }
  }, []);

  return (
    <SimpleWalkthroughContext.Provider
      value={{
        state,
        startWalkthrough,
        startFlow,
        nextStep,
        advanceToNextPage,
        skipWalkthrough,
        cancelWalkthrough,
        clearFlow,
        getCurrentPageSegment,
        triggerCompletionEvent,
      }}
    >
      {children}
    </SimpleWalkthroughContext.Provider>
  );
}

export function useSimpleWalkthrough() {
  const context = useContext(SimpleWalkthroughContext);
  if (!context) {
    throw new Error("useSimpleWalkthrough must be used within SimpleWalkthroughProvider");
  }
  return context;
}
