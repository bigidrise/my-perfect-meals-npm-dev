// ✅ VoiceInputHandler.tsx
// This manages speech recognition, wake word detection, and emits transcript

import React, { useEffect, useRef, useState } from 'react';
import { useVoiceContext } from '@/context/VoiceContext';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const VoiceInputHandler = () => {
  const { setTranscript, setIsListening, setIsProcessing, setError } = useVoiceContext();
  const recognitionRef = useRef<any>(null);
  const [wakeWordHeard, setWakeWordHeard] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognition.start(); // auto-restart
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceError]', event);
      // Don't show errors for common mobile/browser issues
      if (event.error !== 'no-speech' && event.error !== 'audio-capture' && event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
    };

    recognition.onresult = (event: any) => {
      const raw = event.results[event.resultIndex][0].transcript.toLowerCase().trim();
      console.log('[Voice Raw Transcript]:', raw);

      if (!wakeWordHeard && raw.includes('hey chef')) {
        setWakeWordHeard(true);
        return; // Wait for the *next* phrase
      }

      if (wakeWordHeard) {
        recognition.stop();
        setWakeWordHeard(false);
        setIsProcessing(true);
        setTranscript(raw);
      }
    };

    recognition.start();

    return () => {
      recognition.stop();
    };
  }, [setTranscript, setIsListening, setIsProcessing, setError, wakeWordHeard]);

  return null;
};