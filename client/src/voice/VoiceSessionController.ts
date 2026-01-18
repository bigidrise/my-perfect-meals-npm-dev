// client/src/voice/VoiceSessionController.ts

export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

type VoiceCallbacks = {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (text: string) => void;
};

const SILENCE_TIMEOUT_MS = 7000;
let recognition: any = null;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let hasNudged = false;

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

  private startListening() {
    this.clearSilenceTimer();

    if (!("webkitSpeechRecognition" in window)) {
      console.warn("Speech recognition not supported");
      return;
    }

    // @ts-ignore
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      this.clearSilenceTimer();
      const transcript = event.results[0][0].transcript;
      recognition?.stop();
      this.handleUserFinishedTalking(transcript);
    };

    recognition.onerror = () => {
      this.clearSilenceTimer();
      recognition?.stop();
      this.setState("listening");
      this.startListening();
    };

    silenceTimer = setTimeout(() => {
      recognition?.stop();
      this.handleSilenceTimeout();
    }, SILENCE_TIMEOUT_MS);

    recognition.start();
  }

  private stopListening() {
    this.clearSilenceTimer();
    recognition?.stop();
    recognition = null;
  }

  private speak(text: string, onEnd?: () => void) {
    this.stopListening();

    setTimeout(() => {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => onEnd?.();
        window.speechSynthesis.speak(utterance);
      } else {
        console.log("[Chef]:", text);
        onEnd?.();
      }
    }, 400);
  }

  private stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
