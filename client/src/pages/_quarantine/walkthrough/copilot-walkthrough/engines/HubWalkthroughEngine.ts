import { waitForElement, waitForNavigationReady } from "../../WalkthroughEngine";

/**
 * Hub Walkthrough Engine - Phase C.7
 * 
 * Handles intelligent branching walkthroughs for multi-page hubs (Craving, Kids, Alcohol, Socializing)
 * Supports voice, text, and tap selection with timeout and error fallbacks
 */

export interface HubSubOption {
  id: string;
  name: string;
  route: string;
  testId: string;
  voiceAliases?: string[];
}

export interface HubWalkthroughConfig {
  hubId: string;
  hubName: string;
  subOptions: HubSubOption[];
  selectionPrompt: string;
  voiceTimeoutMessage: string;
  onSelection: (subOption: HubSubOption) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

type EngineStatus = "idle" | "active" | "waiting_for_selection" | "navigating" | "cancelled";

export class HubWalkthroughEngine {
  private config: HubWalkthroughConfig | null = null;
  private status: EngineStatus = "idle";
  private abortController: AbortController | null = null;
  private voiceTimeoutId: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, EventListener> = new Map();

  /**
   * Start hub walkthrough - show selection prompt and wait for user input
   */
  async start(config: HubWalkthroughConfig): Promise<void> {
    if (this.status !== "idle") {
      console.warn(`[HubWalkthroughEngine] Cannot start - engine status is ${this.status}`);
      return;
    }

    this.config = config;
    this.status = "active";
    this.abortController = new AbortController();

    // Emit "opened" event
    this.emitHubEvent("opened", { hubId: config.hubId });

    // Wait for hub page to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Attach click listeners to all sub-option cards
    this.attachClickListeners();

    // Start voice timeout (6 seconds)
    this.startVoiceTimeout();

    // Update status
    this.status = "waiting_for_selection";
  }

  /**
   * Handle voice selection from Copilot
   */
  async handleVoiceSelection(spokenText: string): Promise<boolean> {
    if (!this.config || this.status !== "waiting_for_selection") {
      return false;
    }

    // Clear voice timeout
    if (this.voiceTimeoutId) {
      clearTimeout(this.voiceTimeoutId);
      this.voiceTimeoutId = null;
    }

    // Find matching sub-option by voice alias
    const matchedOption = this.findSubOptionByAlias(spokenText);

    if (matchedOption) {
      await this.selectSubOption(matchedOption, "spoken");
      return true;
    } else {
      // Emit error for fuzzy match / clarification
      this.emitError(`Did you mean one of: ${this.config.subOptions.map(o => o.name).join(", ")}?`);
      return false;
    }
  }

  /**
   * Handle tap/click selection
   */
  async handleTapSelection(testId: string): Promise<void> {
    if (!this.config || this.status !== "waiting_for_selection") {
      return;
    }

    const matchedOption = this.config.subOptions.find((opt) => opt.testId === testId);

    if (matchedOption) {
      await this.selectSubOption(matchedOption, "selected");
    }
  }

  /**
   * Handle text input selection from Copilot text command
   */
  async handleTextSelection(text: string): Promise<boolean> {
    // Reuse voice selection logic (same alias matching)
    return this.handleVoiceSelection(text);
  }

  /**
   * Cancel the hub walkthrough
   */
  async cancel(): Promise<void> {
    if (this.status === "idle" || this.status === "cancelled") {
      return;
    }

    this.status = "cancelled";

    // Clear voice timeout
    if (this.voiceTimeoutId) {
      clearTimeout(this.voiceTimeoutId);
      this.voiceTimeoutId = null;
    }

    // Abort any pending operations
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Remove all event listeners
    this.cleanupEventListeners();

    // Call cancel callback
    if (this.config?.onCancel) {
      this.config.onCancel();
    }

    // Reset state
    this.reset();
  }

  /**
   * Get current engine status
   */
  getStatus(): EngineStatus {
    return this.status;
  }

  /**
   * Private: Select a sub-option and navigate
   */
  private async selectSubOption(subOption: HubSubOption, eventType: "selected" | "spoken"): Promise<void> {
    if (!this.config) return;

    this.status = "navigating";

    // Clear voice timeout
    if (this.voiceTimeoutId) {
      clearTimeout(this.voiceTimeoutId);
      this.voiceTimeoutId = null;
    }

    // Remove event listeners
    this.cleanupEventListeners();

    // Emit selection event
    this.emitHubEvent(eventType, {
      hubId: this.config.hubId,
      subOptionId: subOption.id,
      subOptionName: subOption.name,
    });

    // Call selection callback
    this.config.onSelection(subOption);

    // Reset engine
    this.reset();
  }

  /**
   * Private: Find sub-option by spoken text or alias
   */
  private findSubOptionByAlias(spokenText: string): HubSubOption | null {
    if (!this.config) return null;

    const normalized = spokenText.toLowerCase().trim();

    return (
      this.config.subOptions.find((opt) => {
        // Check exact name match
        if (opt.name.toLowerCase() === normalized) return true;

        // Check voice aliases
        if (opt.voiceAliases) {
          return opt.voiceAliases.some((alias) => alias.toLowerCase() === normalized);
        }

        // Check if spoken text contains the option name
        return normalized.includes(opt.name.toLowerCase());
      }) || null
    );
  }

  /**
   * Private: Attach click listeners to sub-option cards
   */
  private attachClickListeners(): void {
    if (!this.config) return;

    this.config.subOptions.forEach((subOption) => {
      const selector = `[data-testid="${subOption.testId}"]`;
      const element = document.querySelector(selector);

      if (element) {
        const listener = () => {
          this.handleTapSelection(subOption.testId);
        };

        element.addEventListener("click", listener);
        this.eventListeners.set(subOption.testId, listener);
      } else {
        console.warn(`[HubWalkthroughEngine] Element not found: ${selector}`);
      }
    });
  }

  /**
   * Private: Start voice timeout (10 seconds)
   */
  private startVoiceTimeout(): void {
    if (!this.config) return;

    this.voiceTimeoutId = setTimeout(() => {
      if (this.status === "waiting_for_selection") {
        this.emitError(this.config?.voiceTimeoutMessage || "Voice timeout - please try typing your selection instead.");
      }
    }, 10000);
  }

  /**
   * Private: Cleanup all event listeners
   */
  private cleanupEventListeners(): void {
    this.eventListeners.forEach((listener, testId) => {
      const selector = `[data-testid="${testId}"]`;
      const element = document.querySelector(selector);
      if (element) {
        element.removeEventListener("click", listener);
      }
    });
    this.eventListeners.clear();
  }

  /**
   * Private: Emit hub walkthrough event
   */
  private emitHubEvent(eventType: string, detail: any): void {
    const event = new CustomEvent("walkthrough:event", {
      detail: {
        type: eventType,
        ...detail,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Private: Emit error
   */
  private emitError(error: string): void {
    console.warn(`[HubWalkthroughEngine] ${error}`);

    if (this.config?.onError) {
      this.config.onError(error);
    }

    this.emitHubEvent("error", {
      hubId: this.config?.hubId,
      error,
    });
  }

  /**
   * Private: Reset engine state
   */
  private reset(): void {
    this.config = null;
    this.status = "idle";
    this.abortController = null;
    this.voiceTimeoutId = null;
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const hubWalkthroughEngine = new HubWalkthroughEngine();
