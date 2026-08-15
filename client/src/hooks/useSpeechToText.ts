import { useCallback, useEffect, useRef, useState } from 'react';
import { iosAudioSession } from '@/lib/iosAudioSession';

type SpeechState = 'idle' | 'listening' | 'error' | 'unsupported';

export function useSpeechToText() {
  const [state, setState] = useState<SpeechState>('idle');
  const [text, setText] = useState('');
  const recRef = useRef<any>(null);
  // Track listening state via ref so onend/onerror callbacks always see the
  // current value without a stale closure.
  const stateRef = useRef<SpeechState>('idle');

  // Keep the ref in sync with the state value on every render.
  stateRef.current = state;

  useEffect(() => {
    const SpeechRec: any =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (!SpeechRec) {
      setState('unsupported');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setText(t);
    };

    rec.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
      // Abort cleanly so onend fires and we don't leave a dangling session.
      try { rec.abort(); } catch (_) {}
      setState('error');
    };

    rec.onend = () => {
      // Use the ref so we always read the *current* state, not the stale
      // closure value from mount time.
      if (stateRef.current === 'listening') {
        setState('idle');
      }
    };

    recRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) { setState('unsupported'); return; }
    try {
      // iOS: Reset audio session to switch from output to input mode
      await iosAudioSession.resetForInput();
      rec.start();
      setState('listening');
    } catch (error) {
      console.log('Speech start error:', error);
      setState('error');
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try { rec.stop(); } catch (error) {
        console.log('Speech stop error:', error);
      }
    }
    setState('idle');
  }, []);

  const reset = useCallback(() => setText(''), []);

  return {
    state,
    text,
    start,
    stop,
    reset,
    supported: state !== 'unsupported',
  };
}
