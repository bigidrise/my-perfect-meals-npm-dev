// Walkthrough system quarantined - stub the function with proper types
type WalkthroughConfig = { scriptId?: string } | null;
const getWalkthroughConfig = (_path: string): WalkthroughConfig => null;

type StoreSubscriber = () => void;

const DISABLED_PATHS_KEY = 'copilot_disabled_pages';

class CopilotExplanationStoreClass {
  private explainedPaths = new Map<string, boolean>();
  private disabledPaths = new Set<string>();
  private subscribers = new Set<StoreSubscriber>();
  private version = 0;

  constructor() {
    this.loadDisabledPaths();
  }

  private loadDisabledPaths(): void {
    try {
      const saved = localStorage.getItem(DISABLED_PATHS_KEY);
      if (saved) {
        const paths = JSON.parse(saved) as string[];
        paths.forEach(path => this.disabledPaths.add(path));
      }
    } catch {
      console.warn('[CopilotStore] Failed to load disabled paths');
    }
  }

  private saveDisabledPaths(): void {
    try {
      const paths = Array.from(this.disabledPaths);
      localStorage.setItem(DISABLED_PATHS_KEY, JSON.stringify(paths));
    } catch {
      console.warn('[CopilotStore] Failed to save disabled paths');
    }
  }

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

  // ========================================
  // PER-PAGE DISABLE (persistent - localStorage)
  // User explicitly turned off auto-open for this page
  // ========================================
  disablePath(path: string): void {
    if (!this.disabledPaths.has(path)) {
      this.disabledPaths.add(path);
      this.saveDisabledPaths();
      this.notify();
    }
  }

  enablePath(path: string): void {
    if (this.disabledPaths.has(path)) {
      this.disabledPaths.delete(path);
      this.saveDisabledPaths();
      this.notify();
    }
  }

  isPathDisabled(path: string): boolean {
    return this.disabledPaths.has(path);
  }

  // ========================================
  // EXPLAINED PATHS (session only - in memory)
  // Tracks pages that have already auto-opened this session
  // ========================================
  markExplained(path: string): void {
    if (!this.explainedPaths.has(path)) {
      this.explainedPaths.set(path, true);
      this.notify();
    }
  }

  hasExplained(path: string): boolean {
    return this.explainedPaths.get(path) === true;
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

  clearAllDisabled(): void {
    if (this.disabledPaths.size > 0) {
      this.disabledPaths.clear();
      this.saveDisabledPaths();
      this.notify();
    }
  }
}

export const CopilotExplanationStore = new CopilotExplanationStoreClass();
