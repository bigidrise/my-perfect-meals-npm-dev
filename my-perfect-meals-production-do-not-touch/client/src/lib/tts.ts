/**
 * TTS Service with Graceful Degradation
 * ElevenLabs → Browser SpeechSynthesis → Silent Mode
 * 
 * Apple App Store Ready - Works 100% offline
 * SSR/Test Safe - Guards all browser APIs
 * 
 * Audio Completion Events - For reliable UI sync
 */

import { apiUrl } from './resolveApiBase';

type TTSProvider = 'elevenlabs' | 'browser' | 'silent';

interface TTSResult {
  provider: TTSProvider;
  audioUrl?: string;
  success: boolean;
  error?: string;
}

// Callbacks for audio lifecycle events
export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Browser API availability check
const isBrowser = typeof window !== 'undefined';

// Preload voices for iOS (getVoices returns [] until voiceschanged fires)
let voicesLoaded = false;
if (isBrowser && window.speechSynthesis) {
  window.speechSynthesis.getVoices(); // Trigger load
  window.speechSynthesis.onvoiceschanged = () => {
    voicesLoaded = true;
  };
}

class TTSService {
  private failureCount = 0;
  private readonly MAX_FAILURES = 3;
  private elevenLabsDisabled = false;

  /**
   * Speak text with automatic fallback
   * 1. Try ElevenLabs API
   * 2. Fallback to browser SpeechSynthesis
   * 3. Silent mode (no audio, no errors)
   * 
   * @param text - Text to speak
   * @param callbacks - Optional callbacks for audio lifecycle events
   *   - onStart: Called when audio starts playing
   *   - onEnd: Called when audio finishes playing
   *   - onError: Called if audio fails
   */
  async speak(text: string, callbacks?: TTSCallbacks): Promise<TTSResult> {
    // Try ElevenLabs first (if not disabled)
    if (!this.elevenLabsDisabled) {
      const elevenLabsResult = await this.tryElevenLabs(text);
      if (elevenLabsResult.success) {
        this.failureCount = 0; // Reset on success
        // Note: For ElevenLabs, callbacks are handled by the audio element in CopilotSheet
        // The audioUrl is played there, so onStart/onEnd are wired to <audio> events
        return elevenLabsResult;
      }

      // Track failures
      this.failureCount++;
      if (this.failureCount >= this.MAX_FAILURES) {
        console.warn('[TTS] ElevenLabs disabled after repeated failures');
        this.elevenLabsDisabled = true;
      }
    }

    // Fallback to browser speech
    const browserResult = await this.tryBrowserSpeech(text, callbacks);
    if (browserResult.success) {
      return browserResult;
    }

    // Silent mode (always succeeds) - trigger callbacks immediately
    callbacks?.onStart?.();
    callbacks?.onEnd?.();
    return {
      provider: 'silent',
      success: true,
    };
  }

  /**
   * Try ElevenLabs API
   */
  private async tryElevenLabs(text: string): Promise<TTSResult> {
    if (!isBrowser || typeof fetch === 'undefined') {
      return { provider: 'elevenlabs', success: false, error: 'Not in browser context' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`ElevenLabs API error: ${res.status}`);
      }

      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      return {
        provider: 'elevenlabs',
        audioUrl: url,
        success: true,
      };
    } catch (err: any) {
      console.warn('[TTS] ElevenLabs failed:', err.message);
      return {
        provider: 'elevenlabs',
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Try browser SpeechSynthesis API
   * Works offline, no cost, no rate limits
   * Wires callbacks to utterance events for reliable UI sync
   */
  private async tryBrowserSpeech(text: string, callbacks?: TTSCallbacks): Promise<TTSResult> {
    if (!isBrowser || !window.speechSynthesis) {
      callbacks?.onError?.('Not in browser context');
      return { provider: 'browser', success: false, error: 'Not in browser context' };
    }

    try {
      // iOS: Wait briefly for voices to load if not yet loaded
      if (!voicesLoaded) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      // Wire callbacks to utterance events
      if (callbacks?.onStart) {
        utterance.onstart = () => callbacks.onStart?.();
      }
      if (callbacks?.onEnd) {
        utterance.onend = () => callbacks.onEnd?.();
      }
      if (callbacks?.onError) {
        utterance.onerror = (event) => callbacks.onError?.(event.error || 'Speech synthesis error');
      }

      // Try to use a high-quality MALE voice to match Chef character
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Daniel') || // iOS male
        v.name.includes('Aaron') || // iOS male
        v.name.includes('Male') || // Any male voice
        v.name.includes('Google UK English Male') // Android male
      ) || voices.find(v => v.lang.startsWith('en-')); // Fallback to any English
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);

      return {
        provider: 'browser',
        success: true,
      };
    } catch (err: any) {
      console.warn('[TTS] Browser speech failed:', err.message);
      callbacks?.onError?.(err.message);
      return {
        provider: 'browser',
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (isBrowser && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Reset circuit breaker (for testing)
   */
  reset(): void {
    this.failureCount = 0;
    this.elevenLabsDisabled = false;
  }
}

// Singleton instance
export const ttsService = new TTSService();
