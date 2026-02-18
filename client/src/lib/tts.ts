/**
 * TTS Service - ElevenLabs ONLY
 * 
 * BRANDED VOICE ONLY - NO FALLBACKS
 * If ElevenLabs fails, stay silent - never use system voice
 * 
 * @deprecated Use VoiceManager instead for new code
 */

import { apiUrl } from './resolveApiBase';

type TTSProvider = 'elevenlabs' | 'silent';

interface TTSResult {
  provider: TTSProvider;
  audioUrl?: string;
  success: boolean;
  error?: string;
}

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

const isBrowser = typeof window !== 'undefined';

class TTSService {
  /**
   * Speak text using ElevenLabs ONLY
   * NO browser speech fallback - branded voice or silence
   */
  async speak(text: string, callbacks?: TTSCallbacks): Promise<TTSResult> {
    const elevenLabsResult = await this.tryElevenLabs(text);
    if (elevenLabsResult.success) {
      return elevenLabsResult;
    }

    console.log('[TTS] ElevenLabs failed, staying silent (no fallback)');
    callbacks?.onStart?.();
    callbacks?.onEnd?.();
    return {
      provider: 'silent',
      success: true,
    };
  }

  private async tryElevenLabs(text: string): Promise<TTSResult> {
    if (!isBrowser || typeof fetch === 'undefined') {
      return { provider: 'elevenlabs', success: false, error: 'Not in browser context' };
    }

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

  stop(): void {
    // No-op for ElevenLabs (audio element handles this)
  }

  reset(): void {
    // No-op - no circuit breaker needed
  }
}

export const ttsService = new TTSService();
