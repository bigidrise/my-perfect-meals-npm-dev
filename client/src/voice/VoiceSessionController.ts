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
    this.setState("speaking");
    this.speakOpeningLine();
  }

  stopVoiceMode() {
    this.setState("idle");
    this.stopListening();
    this.stopSpeaking();
  }

  // ---- CORE FLOW ----

  private speakOpeningLine() {
    this.speak(
      "Hey — what are you in the mood for right now?",
      () => {
        this.setState("listening");
        this.startListening();
      }
    );
  }

  private handleUserFinishedTalking(transcript: string) {
    this.setState("thinking");
    this.callbacks.onTranscript?.(transcript);
  }

  // ---- PLACEHOLDERS (we wire these next) ----

  private startListening() {
    // Speech-to-text starts here
  }

  private stopListening() {
    // Stop mic
  }

  private speak(text: string, onEnd?: () => void) {
    // ElevenLabs playback goes here
    // Call onEnd() when audio finishes
  }

  private stopSpeaking() {
    // Stop audio playback if needed
  }
}
