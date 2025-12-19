// Walkthrough system quarantined - stub the function with proper types
type WalkthroughConfig = { scriptId?: string } | null;
const getWalkthroughConfig = (_path: string): WalkthroughConfig => null;

type StoreSubscriber = () => void;

class CopilotExplanationStoreClass {
  private explainedPaths = new Map<string, boolean>();
  private subscribers = new Set<StoreSubscriber>();
  private version = 0;
  
  // Session-scoped: tracks paths opened THIS navigation session
  // Prevents re-opening after skip/close while still on same page
  // Resets when you navigate to a different page
  private sessionOpenedPaths = new Set<string>();
  private currentSessionPath: string | null = null;

  subscribe(callback: StoreSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getSnapshot(): number {
    return this.version;
  }

  private notify(): void {
    this.version++;
    this.subscribers.forEach(cb => cb());
  }

  markExplained(path: string): void {
    if (!this.explainedPaths.has(path)) {
      this.explainedPaths.set(path, true);
      this.notify();
    }
  }

  hasExplained(path: string): boolean {
    return this.explainedPaths.get(path) === true;
  }

  // Session tracking: mark that we've opened Copilot for this path THIS visit
  markSessionOpened(path: string): void {
    // If navigating to new page, clear old session tracking
    if (this.currentSessionPath !== path) {
      this.sessionOpenedPaths.clear();
      this.currentSessionPath = path;
    }
    this.sessionOpenedPaths.add(path);
  }

  // Check if we already opened Copilot for this path this session
  hasSessionOpened(path: string): boolean {
    // If we're on a different path, this is a new session
    if (this.currentSessionPath !== path) {
      return false;
    }
    return this.sessionOpenedPaths.has(path);
  }

  // Called when navigating away - clears session for old path
  clearSessionForPath(path: string): void {
    if (this.currentSessionPath === path) {
      this.sessionOpenedPaths.delete(path);
    }
  }

  resetForScript(scriptId: string): void {
    let changed = false;
    for (const [path] of this.explainedPaths) {
      const config = getWalkthroughConfig(path);
      if (config && config.scriptId === scriptId) {
        this.explainedPaths.delete(path);
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  resetPath(path: string): void {
    if (this.explainedPaths.has(path)) {
      this.explainedPaths.delete(path);
      this.notify();
    }
  }

  clear(): void {
    if (this.explainedPaths.size > 0) {
      this.explainedPaths.clear();
      this.notify();
    }
  }
}

export const CopilotExplanationStore = new CopilotExplanationStoreClass();
