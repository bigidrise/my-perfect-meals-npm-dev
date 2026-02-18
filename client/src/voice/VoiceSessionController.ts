// client/src/voice/VoiceSessionController.ts
import { iosAudioSession } from "@/lib/iosAudioSession";

export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

type VoiceCallbacks = {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string) => void;
};

const SILENCE_TIMEOUT_MS = 10000; // Increased from 7s to 10s
const FINAL_SPEECH_DELAY_MS = 2000; // Wait 2s after last speech before processing
let recognition: any = null;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let speechEndTimer: ReturnType<typeof setTimeout> | null = null;
let hasNudged = false;
let interimTranscript = "";

export class VoiceSessionController {
  private state: VoiceState = "idle";
  private callbacks: VoiceCallbacks;

  constructor(callbacks?: VoiceCallbacks) {
    this.callbacks = callbacks || {};
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  getState(): VoiceState {
    return this.state;
  }

  // ---- PUBLIC API ----

  startVoiceMode() {
    if (this.state !== "idle") return;
    hasNudged = false;
    this.setState("speaking");
    this.speakOpeningLine();
  }

  stopVoiceMode() {
    this.clearSilenceTimer();
    this.setState("idle");
    this.stopListening();
    this.stopSpeaking();
    hasNudged = false;
  }

  // ---- CORE FLOW ----

  private speakOpeningLine() {
    this.speak(
      "Hey — what are you in the mood for right now?",
      () => {
        setTimeout(() => {
          this.setState("listening");
          this.startListening();
        }, 500);
      }
    );
  }

  private handleUserFinishedTalking(transcript: string) {
    this.clearSilenceTimer();
    hasNudged = false;
    this.setState("thinking");
    this.callbacks.onTranscript?.(transcript);
  }

  private handleSilenceTimeout() {
    if (hasNudged) {
      this.stopVoiceMode();
      return;
    }

    hasNudged = true;
    this.setState("speaking");
    this.speak("Still there? Take your time.", () => {
      setTimeout(() => {
        this.setState("listening");
        this.startListening();
      }, 500);
    });
  }

  // ---- SILENCE TIMER ----

  private clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  // ---- SPEECH RECOGNITION ----

  private clearSpeechEndTimer() {
    if (speechEndTimer) {
      clearTimeout(speechEndTimer);
      speechEndTimer = null;
    }
  }

  private async startListening() {
    this.clearSilenceTimer();
    this.clearSpeechEndTimer();
    interimTranscript = "";

    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.warn("Speech recognition not supported");
      return;
    }

    // iOS: Reset audio session to switch from output to input mode
    // Add delay for iOS to properly switch audio routes
    await iosAudioSession.resetForInput();
    await new Promise(resolve => setTimeout(resolve, 300));

    // @ts-ignore
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening for multiple phrases
    recognition.interimResults = true; // Get partial results while speaking
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      this.clearSilenceTimer();
      this.clearSpeechEndTimer();
      
      let finalTranscript = "";
      let tempInterim = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          tempInterim += result[0].transcript;
        }
      }
      
      if (finalTranscript) {
        interimTranscript += finalTranscript;
        console.log("[Voice] Final transcript chunk:", finalTranscript);
      }
      
      // Reset silence timer when we get any speech
      silenceTimer = setTimeout(() => {
        recognition?.stop();
        this.handleSilenceTimeout();
      }, SILENCE_TIMEOUT_MS);
      
      // Wait for user to stop talking (2s pause after last speech)
      if (interimTranscript.trim()) {
        speechEndTimer = setTimeout(() => {
          console.log("[Voice] Speech ended, processing:", interimTranscript);
          recognition?.stop();
          this.handleUserFinishedTalking(interimTranscript.trim());
        }, FINAL_SPEECH_DELAY_MS);
      }
    };

    recognition.onerror = (event: any) => {
      console.log("[Voice] Recognition error:", event.error);
      this.clearSilenceTimer();
      this.clearSpeechEndTimer();
      
      // Handle specific errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // No speech detected or aborted - restart
        recognition?.stop();
        setTimeout(() => {
          if (this.state === "listening") {
            this.startListening();
          }
        }, 500);
      } else if (event.error === 'not-allowed') {
        // Microphone permission denied
        console.error("[Voice] Microphone permission denied");
        this.stopVoiceMode();
      } else {
        // Other errors - try to restart
        recognition?.stop();
        setTimeout(() => {
          if (this.state === "listening") {
            this.startListening();
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      console.log("[Voice] Recognition ended");
    };

    silenceTimer = setTimeout(() => {
      recognition?.stop();
      this.handleSilenceTimeout();
    }, SILENCE_TIMEOUT_MS);

    try {
      recognition.start();
      console.log("[Voice] Recognition started");
    } catch (error) {
      console.error("[Voice] Failed to start recognition:", error);
      setTimeout(() => {
        if (this.state === "listening") {
          this.startListening();
        }
      }, 500);
    }
  }

  private stopListening() {
    this.clearSilenceTimer();
    this.clearSpeechEndTimer();
    interimTranscript = "";
    recognition?.stop();
    recognition = null;
  }

  private speak(text: string, onEnd?: () => void) {
    this.stopListening();

    setTimeout(async () => {
      // Use VoiceManager for branded voice only - no speechSynthesis fallback
      const { voiceManager } = await import('./VoiceManager');
      const result = await voiceManager.speak(text, onEnd);
      if (result.status === 'not_ready' || result.status === 'failed') {
        console.log("[Chef] Voice not ready, staying silent:", text);
        onEnd?.();
      }
    }, 400);
  }

  private stopSpeaking() {
    // Use VoiceManager for stop
    import('./VoiceManager').then(({ voiceManager }) => {
      voiceManager.stop();
    });
  }
}
