export interface VADConfig {
  silenceThresholdMs: number;
  gentlePromptThresholdMs: number;
  offerExitThresholdMs: number;
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  silenceThresholdMs: 5000,
  gentlePromptThresholdMs: 6000,
  offerExitThresholdMs: 12000,
};

export type VADEvent = 
  | { type: "speech_start" }
  | { type: "speech_end" }
  | { type: "silence_gentle_prompt" }
  | { type: "silence_offer_exit" };

export type VADEventHandler = (event: VADEvent) => void;

export class VADController {
  private config: VADConfig;
  private onEvent: VADEventHandler;
  
  private isSpeaking = false;
  private silenceStartTime: number | null = null;
  private gentlePromptTimeout: NodeJS.Timeout | null = null;
  private offerExitTimeout: NodeJS.Timeout | null = null;
  private hasPromptedThisSilence = false;

  constructor(onEvent: VADEventHandler, config: VADConfig = DEFAULT_VAD_CONFIG) {
    this.onEvent = onEvent;
    this.config = config;
  }

  onSpeechDetected(): void {
    this.clearTimeouts();
    this.hasPromptedThisSilence = false;
    
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.silenceStartTime = null;
      this.onEvent({ type: "speech_start" });
    }
  }

  onSpeechEnded(): void {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.silenceStartTime = Date.now();
      this.onEvent({ type: "speech_end" });
      this.startSilenceTimers();
    }
  }

  onSilenceStart(): void {
    if (!this.silenceStartTime) {
      this.silenceStartTime = Date.now();
      this.startSilenceTimers();
    }
  }

  reset(): void {
    this.clearTimeouts();
    this.isSpeaking = false;
    this.silenceStartTime = null;
    this.hasPromptedThisSilence = false;
  }

  private startSilenceTimers(): void {
    this.clearTimeouts();

    this.gentlePromptTimeout = setTimeout(() => {
      if (!this.hasPromptedThisSilence && !this.isSpeaking) {
        this.hasPromptedThisSilence = true;
        this.onEvent({ type: "silence_gentle_prompt" });
      }
    }, this.config.gentlePromptThresholdMs);

    this.offerExitTimeout = setTimeout(() => {
      if (!this.isSpeaking) {
        this.onEvent({ type: "silence_offer_exit" });
      }
    }, this.config.offerExitThresholdMs);
  }

  private clearTimeouts(): void {
    if (this.gentlePromptTimeout) {
      clearTimeout(this.gentlePromptTimeout);
      this.gentlePromptTimeout = null;
    }
    if (this.offerExitTimeout) {
      clearTimeout(this.offerExitTimeout);
      this.offerExitTimeout = null;
    }
  }

  getSilenceDuration(): number {
    if (!this.silenceStartTime) return 0;
    return Date.now() - this.silenceStartTime;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}
