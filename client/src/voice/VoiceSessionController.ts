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

let recognition: any = null;

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
      const transcript = event.results[0][0].transcript;
      recognition?.stop();
      this.handleUserFinishedTalking(transcript);
    };

    recognition.onerror = () => {
      recognition?.stop();
      this.setState("listening");
    };

    recognition.start();
  }

  private stopListening() {
    recognition?.stop();
    recognition = null;
  }

  private speak(text: string, onEnd?: () => void) {
    // ElevenLabs playback goes here - for now use browser TTS
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => onEnd?.();
      window.speechSynthesis.speak(utterance);
    } else {
      console.log("[Chef]:", text);
      onEnd?.();
    }
  }

  private stopSpeaking() {
    // Stop audio playback if needed
  }
}
