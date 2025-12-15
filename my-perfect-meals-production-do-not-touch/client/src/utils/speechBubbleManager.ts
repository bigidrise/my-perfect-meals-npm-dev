// Utility to manage avatar speech bubbles globally
export class SpeechBubbleManager {
  private static instance: SpeechBubbleManager | null = null;
  private callbacks: Array<(text: string) => void> = [];

  static getInstance(): SpeechBubbleManager {
    if (!SpeechBubbleManager.instance) {
      SpeechBubbleManager.instance = new SpeechBubbleManager();
    }
    return SpeechBubbleManager.instance;
  }

  registerCallback(callback: (text: string) => void) {
    this.callbacks.push(callback);
  }

  unregisterCallback(callback: (text: string) => void) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  showSpeechBubble(text: string) {
    const speechTextEnabled = localStorage.getItem('speechTextEnabled') !== 'false';
    if (speechTextEnabled) {
      this.callbacks.forEach(callback => callback(text));
    }
  }
}

export const speechBubbleManager = SpeechBubbleManager.getInstance();