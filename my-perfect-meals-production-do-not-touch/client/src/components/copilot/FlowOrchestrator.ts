// Walkthrough system quarantined - stub these functions with proper types
type WalkthroughConfig = { mode?: string; flowId?: string; scriptId?: string } | null;
type PageSegment = { autoNavigate?: boolean } | null;
const getWalkthroughConfig = (_path: string): WalkthroughConfig => null;
const getPageSegment = (_flowId: string, _pathname: string): PageSegment => null;

type FlowMap = Record<string, string[]>;
type NavigationCallback = (path: string) => void;

const FLOW_SEQUENCES: FlowMap = {
  onboarding: ['/macro-counter', '/my-biometrics', '/weekly-meal-board', '/shopping-list-v2'],
  careteam: ['/care-team', '/pro/clients', '/pro/clients/:id', '/my-biometrics'],
};

/**
 * Match a pathname against a route pattern (supports :param syntax)
 */
function matchRoute(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  
  if (patternParts.length !== pathParts.length) return false;
  
  return patternParts.every((part, i) => {
    return part.startsWith(':') || part === pathParts[i];
  });
}

class FlowOrchestratorService {
  private currentFlowId: string | null = null;
  private currentStepIndex: number = 0;
  private listeners: Set<() => void> = new Set();
  private navigateCallback: NavigationCallback | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('macro:saved', () => this.handleFlowStepComplete('/macro-counter'));
      window.addEventListener('biometrics:weightSaved', () => this.handleFlowStepComplete('/my-biometrics'));
      window.addEventListener('mealBuilder:planGenerated', () => this.handleFlowStepComplete('/weekly-meal-board'));
      window.addEventListener('shoppingList:viewed', () => this.handleFlowStepComplete('/shopping-list-v2'));
      
      // CareTeam flow events
      window.addEventListener('careteam:linked', () => this.handleFlowStepComplete('/care-team'));
      window.addEventListener('pro:clientOpened', () => this.handleFlowStepComplete('/pro/clients'));
      window.addEventListener('pro:macrosSent', () => this.handleFlowStepComplete('/pro/clients/:id'));
      window.addEventListener('biometrics:saved', () => this.handleFlowStepComplete('/my-biometrics'));
    }
  }

  setNavigationCallback(callback: NavigationCallback) {
    this.navigateCallback = callback;
  }

  clearNavigationCallback() {
    this.navigateCallback = null;
  }

  startFlowIfNeeded(pathname: string): boolean {
    const config = getWalkthroughConfig(pathname);
    if (!config || config.mode !== 'flow' || !config.flowId) {
      return false;
    }

    const flowSequence = FLOW_SEQUENCES[config.flowId];
    if (!flowSequence) {
      return false;
    }

    // Try exact match first
    let stepIndex = flowSequence.indexOf(pathname);
    
    // If no exact match, try pattern matching for dynamic routes
    if (stepIndex === -1) {
      stepIndex = flowSequence.findIndex(pattern => matchRoute(pattern, pathname));
    }
    
    if (stepIndex === -1) {
      return false;
    }

    this.currentFlowId = config.flowId;
    this.currentStepIndex = stepIndex;
    
    return true;
  }

  private handleFlowStepComplete(pathname: string): void {
    if (!this.currentFlowId) return;

    const flowSequence = FLOW_SEQUENCES[this.currentFlowId];
    if (!flowSequence) return;

    const currentPath = flowSequence[this.currentStepIndex];
    // Match exact path or pattern
    if (currentPath !== pathname && !matchRoute(currentPath, pathname)) return;

    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex < flowSequence.length) {
      const nextPath = flowSequence[nextIndex];
      this.currentStepIndex = nextIndex;
      
      // Check if the current page segment has autoNavigate set to false
      const currentSegment = getPageSegment(this.currentFlowId, pathname);
      if (currentSegment && currentSegment.autoNavigate === false) {
        // Skip auto-navigation - the page handles it manually
        this.notifyListeners();
        return;
      }
      
      setTimeout(() => {
        if (this.navigateCallback) {
          this.navigateCallback(nextPath);
        } else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flow-navigate', { detail: { path: nextPath } }));
        }
      }, 1000);
    } else {
      this.currentFlowId = null;
      this.currentStepIndex = 0;
      this.notifyListeners();
    }
  }

  isInFlow(): boolean {
    return this.currentFlowId !== null;
  }

  getCurrentFlowId(): string | null {
    return this.currentFlowId;
  }

  resetFlow(): void {
    this.currentFlowId = null;
    this.currentStepIndex = 0;
    this.notifyListeners();
  }

  onFlowChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }
}

export const flowOrchestrator = new FlowOrchestratorService();
