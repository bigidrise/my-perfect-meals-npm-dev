// Walkthrough system quarantined - stub the function with proper types
type WalkthroughConfig = { scriptId?: string } | null;
const getWalkthroughConfig = (_path: string): WalkthroughConfig => null;

type StoreSubscriber = () => void;

class CopilotExplanationStoreClass {
  private explainedPaths = new Map<string, boolean>();
  private subscribers = new Set<StoreSubscriber>();
  private version = 0;

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
