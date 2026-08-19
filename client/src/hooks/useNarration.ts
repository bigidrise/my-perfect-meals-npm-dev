import { useState, useCallback, useRef, useEffect } from "react";
import { ttsService } from "@/lib/tts";
import { useNarrationSpeed } from "@/contexts/NarrationSpeedContext";

interface Section {
  heading: string;
  text?: string;
  list?: string[];
}

interface UseNarrationOptions {
  onSectionChange?: (index: number) => void;
  onEnd?: () => void;
  speedOverride?: string;
}

export function useNarration(sections: Section[], options: UseNarrationOptions = {}) {
  const { onSectionChange, onEnd, speedOverride } = options;
  const { narrationSpeed: contextSpeed } = useNarrationSpeed();
  const narrationSpeed = speedOverride ?? contextSpeed;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [mode, setMode] = useState<"read" | "listen">("read");
  
  const isCancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserTtsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cache ElevenLabs blob URLs so Back 10s can reuse already-fetched audio
  const sectionAudioCache = useRef<Map<number, string>>(new Map());

  const clearBrowserTtsInterval = useCallback(() => {
    if (browserTtsIntervalRef.current !== null) {
      clearInterval(browserTtsIntervalRef.current);
      browserTtsIntervalRef.current = null;
    }
  }, []);

  const buildSectionText = useCallback((section: Section): string => {
    let text = section.heading + ". ";
    if (section.text) {
      text += section.text + " ";
    }
    if (section.list && section.list.length > 0) {
      text += section.list.join(". ") + ".";
    }
    return text;
  }, []);

  const stopAudio = useCallback(() => {
    clearBrowserTtsInterval();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    ttsService.stop();
  }, [clearBrowserTtsInterval]);

  const advanceToNextSection = useCallback((index: number) => {
    if (isCancelledRef.current) return;
    
    const nextIndex = index + 1;
    if (nextIndex >= sections.length) {
      setIsPlaying(false);
      setIsPaused(false);
      onEnd?.();
      return;
    }
    
    setCurrentSectionIndex(nextIndex);
    onSectionChange?.(nextIndex);
  }, [sections.length, onSectionChange, onEnd]);

  // Attach and play an already-fetched audio URL (used by cache replay and skipBack10)
  const playAudioUrl = useCallback((url: string, sectionIndex: number) => {
    const audio = new Audio(url);
    audio.playbackRate = parseFloat(narrationSpeed);
    audioRef.current = audio;

    audio.onplay = () => {
      if (!isCancelledRef.current) {
        setIsPlaying(true);
        setIsPaused(false);
      }
    };

    audio.onended = () => {
      if (!isCancelledRef.current) {
        advanceToNextSection(sectionIndex);
        speakSection(sectionIndex + 1);
      }
    };

    audio.onerror = () => {
      if (!isCancelledRef.current) {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    if (!isCancelledRef.current) {
      audio.play().catch(() => {
        setIsPlaying(false);
        setIsPaused(false);
      });
    }
  // speakSection is defined below — forward-ref pattern via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceToNextSection, narrationSpeed]);

  const speakSectionRef = useRef<(index: number) => void>(() => {});

  const speakSection = useCallback(async (index: number) => {
    if (index >= sections.length || isCancelledRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      onEnd?.();
      return;
    }

    const section = sections[index];
    const text = buildSectionText(section);
    
    // Use cached audio if available for this section
    const cached = sectionAudioCache.current.get(index);
    if (cached) {
      playAudioUrl(cached, index);
      return;
    }

    try {
      const result = await ttsService.speak(text);

      if (isCancelledRef.current) return;

      if (result.provider === "elevenlabs" && result.audioUrl) {
        // Cache the URL before playing — don't revoke, keep for rewind
        sectionAudioCache.current.set(index, result.audioUrl);
        playAudioUrl(result.audioUrl, index);
      } else {
        advanceToNextSection(index);
        speakSection(index + 1);
      }
    } catch (err) {
      console.warn("[useNarration] TTS error:", err);
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [sections, buildSectionText, onEnd, advanceToNextSection, clearBrowserTtsInterval, playAudioUrl]);

  // Keep ref in sync so playAudioUrl can call speakSection
  useEffect(() => {
    speakSectionRef.current = speakSection;
  }, [speakSection]);

  const play = useCallback(() => {
    if (sections.length === 0) return;
    
    isCancelledRef.current = false;
    setIsPaused(false);
    stopAudio();
    speakSection(currentSectionIndex);
  }, [sections, currentSectionIndex, speakSection, stopAudio]);

  const pause = useCallback(() => {
    clearBrowserTtsInterval();
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setIsPlaying(false);
    setIsPaused(true);
  }, [clearBrowserTtsInterval]);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsPaused(false);
        })
        .catch(() => {});
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      isCancelledRef.current = false;
      setIsPaused(false);
      speakSection(currentSectionIndex);
    }
  }, [currentSectionIndex, speakSection]);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSectionIndex(0);
  }, [stopAudio]);

  // ── BACK 10 SECONDS ──────────────────────────────────────────────────────────
  // Within the current section: seek back 10s on the audio element.
  // If at or near the start of the section: restart the previous section,
  // using the cached blob URL when available to avoid a new ElevenLabs fetch.
  const skipBack10 = useCallback(() => {
    // ElevenLabs path — audio element exists
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime - 10;
      if (newTime >= 0) {
        // Simple seek within same section
        audioRef.current.currentTime = newTime;
        return;
      }
      // Past the beginning of this section
      if (currentSectionIndex === 0) {
        // Already at the first section — just restart from 0
        audioRef.current.currentTime = 0;
        return;
      }
      // Jump to previous section
      const prevIndex = currentSectionIndex - 1;
      stopAudio();
      isCancelledRef.current = false;
      setCurrentSectionIndex(prevIndex);
      onSectionChange?.(prevIndex);
      setIsPlaying(true);
      setIsPaused(false);
      // Use cached URL if we have it, otherwise speakSection will fetch
      speakSection(prevIndex);
      return;
    }

    // Browser TTS path — no seekable audio element, restart current section
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    clearBrowserTtsInterval();
    isCancelledRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    speakSection(currentSectionIndex);
  }, [currentSectionIndex, stopAudio, speakSection, onSectionChange, clearBrowserTtsInterval]);

  const nextSection = useCallback(() => {
    if (currentSectionIndex < sections.length - 1) {
      stopAudio();
      const nextIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIndex);
      onSectionChange?.(nextIndex);
      if (isPlaying) {
        isCancelledRef.current = false;
        setIsPaused(false);
        speakSection(nextIndex);
      }
    }
  }, [currentSectionIndex, sections.length, isPlaying, speakSection, onSectionChange, stopAudio]);

  const reset = useCallback(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSectionIndex(0);
    setMode("read");
  }, [stopAudio]);

  const toggleMode = useCallback((newMode: "read" | "listen") => {
    if (newMode === "read" && mode === "listen") {
      stop();
    }
    setMode(newMode);
  }, [mode, stop]);

  // Cleanup on unmount — revoke all cached blob URLs to free memory
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      stopAudio();
      sectionAudioCache.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      sectionAudioCache.current.clear();
    };
  }, [stopAudio]);

  useEffect(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSectionIndex(0);
    // Clear cache when sections change (new Pro Tip set)
    sectionAudioCache.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    sectionAudioCache.current.clear();
  }, [sections, stopAudio]);

  return {
    isPlaying,
    isPaused,
    currentSectionIndex,
    mode,
    totalSections: sections.length,
    play,
    pause,
    resume,
    stop,
    nextSection,
    reset,
    toggleMode,
    setMode,
    skipBack10,
  };
}
