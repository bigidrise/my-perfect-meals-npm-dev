/**
 * VoiceProvider - React context for VoiceManager
 * Provides useVoice hook for components to request speech
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { voiceManager, VoiceStatus, SpeakResult } from './VoiceManager';

interface VoiceContextValue {
  status: VoiceStatus;
  isReady: boolean;
  isSpeaking: boolean;
  enableVoice: () => Promise<boolean>;
  speak: (text: string, onEnd?: () => void) => Promise<SpeakResult>;
  stop: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

interface VoiceProviderProps {
  children: ReactNode;
}

export function VoiceProvider({ children }: VoiceProviderProps) {
  const [status, setStatus] = useState<VoiceStatus>(voiceManager.getStatus());

  useEffect(() => {
    return voiceManager.subscribe(setStatus);
  }, []);

  const enableVoice = useCallback(async () => {
    return voiceManager.preload();
  }, []);

  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    return voiceManager.speak(text, onEnd);
  }, []);

  const stop = useCallback(() => {
    voiceManager.stop();
  }, []);

  const value: VoiceContextValue = {
    status,
    isReady: status === 'ready' || status === 'speaking',
    isSpeaking: status === 'speaking',
    enableVoice,
    speak,
    stop,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within VoiceProvider');
  }
  return context;
}

/**
 * Lightweight hook for components that just need to speak
 * Automatically enables voice on first use
 */
export function useSpeak() {
  const { speak, enableVoice, isReady } = useVoice();

  const speakWithAutoEnable = useCallback(async (text: string, onEnd?: () => void) => {
    if (!isReady) {
      await enableVoice();
    }
    return speak(text, onEnd);
  }, [speak, enableVoice, isReady]);

  return speakWithAutoEnable;
}
