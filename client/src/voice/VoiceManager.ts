/**
 * VoiceManager - Single authority for all voice output
 * 
 * GOLDEN RULE: Branded ElevenLabs voice only. NO fallbacks.
 * If voice isn't ready, stay silent - never use system voice.
 */

import { apiUrl } from '@/lib/resolveApiBase';

export type VoiceStatus = 'not_ready' | 'ready' | 'loading' | 'speaking' | 'error';

export interface SpeakResult {
  status: 'playing' | 'queued' | 'not_ready' | 'failed' | 'silent';
  reason?: string;
}

interface VoiceManagerState {
  status: VoiceStatus;
  sessionLocked: boolean;
  currentAudio: HTMLAudioElement | null;
  queue: Array<{ text: string; onEnd?: () => void }>;
}

class VoiceManagerSingleton {
  private state: VoiceManagerState = {
    status: 'not_ready',
    sessionLocked: false,
    currentAudio: null,
    queue: [],
  };

  private listeners: Set<(status: VoiceStatus) => void> = new Set();
  private preloadPromise: Promise<boolean> | null = null;

  getStatus(): VoiceStatus {
    return this.state.status;
  }

  isReady(): boolean {
    return this.state.status === 'ready' || this.state.status === 'speaking';
  }

  subscribe(listener: (status: VoiceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: VoiceStatus) {
    this.state.status = status;
    this.listeners.forEach(fn => fn(status));
  }

  /**
   * Preload/warm up the voice - call on first user gesture
   * This validates the API connection and locks the session
   */
  async preload(): Promise<boolean> {
    if (this.preloadPromise) return this.preloadPromise;
    if (this.state.sessionLocked) return true;

    this.setStatus('loading');

    this.preloadPromise = (async () => {
      try {
        const res = await fetch(apiUrl('/api/tts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ' ' }),
        });

        if (!res.ok) {
          console.warn('[VoiceManager] Preload failed:', res.status);
          this.setStatus('error');
          return false;
        }

        this.state.sessionLocked = true;
        this.setStatus('ready');
        console.log('[VoiceManager] Voice preloaded and session locked');
        return true;
      } catch (err) {
        console.warn('[VoiceManager] Preload error:', err);
        this.setStatus('error');
        return false;
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Request to speak text
   * Returns immediately - use onEnd callback for completion
   * 
   * RULE: If voice isn't ready, returns 'not_ready' - never falls back
   */
  async speak(text: string, onEnd?: () => void): Promise<SpeakResult> {
    if (!text || text.trim().length === 0) {
      onEnd?.();
      return { status: 'silent', reason: 'Empty text' };
    }

    if (!this.isReady()) {
      console.log('[VoiceManager] Voice not ready, staying silent');
      onEnd?.();
      return { status: 'not_ready', reason: 'Voice not initialized' };
    }

    if (this.state.status === 'speaking') {
      this.state.queue.push({ text, onEnd });
      return { status: 'queued' };
    }

    return this.playNow(text, onEnd);
  }

  private async playNow(text: string, onEnd?: () => void): Promise<SpeakResult> {
    this.setStatus('speaking');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`TTS API error: ${res.status}`);
      }

      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      this.state.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.state.currentAudio = null;
        onEnd?.();
        this.playNext();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.state.currentAudio = null;
        console.warn('[VoiceManager] Audio playback error');
        onEnd?.();
        this.playNext();
      };

      await audio.play();
      return { status: 'playing' };
    } catch (err: any) {
      console.warn('[VoiceManager] Speak failed:', err.message);
      this.setStatus('ready');
      onEnd?.();
      return { status: 'failed', reason: err.message };
    }
  }

  private playNext() {
    const next = this.state.queue.shift();
    if (next) {
      this.playNow(next.text, next.onEnd);
    } else {
      this.setStatus('ready');
    }
  }

  /**
   * Stop current speech and clear queue
   */
  stop() {
    if (this.state.currentAudio) {
      this.state.currentAudio.pause();
      this.state.currentAudio = null;
    }
    this.state.queue = [];
    if (this.state.status === 'speaking') {
      this.setStatus('ready');
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.state.status === 'speaking';
  }
}

export const voiceManager = new VoiceManagerSingleton();
