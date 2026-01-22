import { useState, useCallback, useRef, useEffect } from "react";
import { ttsService } from "@/lib/tts";

interface Section {
  heading: string;
  text?: string;
  list?: string[];
}

interface UseNarrationOptions {
  onSectionChange?: (index: number) => void;
  onEnd?: () => void;
}

export function useNarration(sections: Section[], options: UseNarrationOptions = {}) {
  const { onSectionChange, onEnd } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [mode, setMode] = useState<"read" | "listen">("read");
  
  const isCancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    ttsService.stop();
  }, []);

  const advanceToNextSection = useCallback((index: number) => {
    if (isCancelledRef.current) return;
    
    const nextIndex = index + 1;
    if (nextIndex >= sections.length) {
      setIsPlaying(false);
      onEnd?.();
      return;
    }
    
    setCurrentSectionIndex(nextIndex);
    onSectionChange?.(nextIndex);
  }, [sections.length, onSectionChange, onEnd]);

  const speakSection = useCallback(async (index: number) => {
    if (index >= sections.length || isCancelledRef.current) {
      setIsPlaying(false);
      onEnd?.();
      return;
    }

    const section = sections[index];
    const text = buildSectionText(section);
    
    try {
      const result = await ttsService.speak(text);

      if (isCancelledRef.current) return;

      if (result.provider === "elevenlabs" && result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        
        audio.onplay = () => {
          if (!isCancelledRef.current) {
            setIsPlaying(true);
          }
        };
        
        audio.onended = () => {
          URL.revokeObjectURL(result.audioUrl!);
          if (!isCancelledRef.current) {
            advanceToNextSection(index);
            speakSection(index + 1);
          }
        };

        audio.onerror = () => {
          if (!isCancelledRef.current) {
            setIsPlaying(false);
          }
        };

        try {
          await audio.play();
        } catch (playErr) {
          console.warn("[useNarration] Audio play failed:", playErr);
          setIsPlaying(false);
        }
      } else if (result.provider === "browser") {
        setIsPlaying(true);
        const checkSpeaking = setInterval(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            clearInterval(checkSpeaking);
            if (!isCancelledRef.current) {
              advanceToNextSection(index);
              speakSection(index + 1);
            }
          }
        }, 100);
      } else {
        advanceToNextSection(index);
        speakSection(index + 1);
      }
    } catch (err) {
      console.warn("[useNarration] TTS error:", err);
      setIsPlaying(false);
    }
  }, [sections, buildSectionText, onEnd, advanceToNextSection]);

  const play = useCallback(() => {
    if (sections.length === 0) return;
    
    isCancelledRef.current = false;
    stopAudio();
    speakSection(currentSectionIndex);
  }, [sections, currentSectionIndex, speakSection, stopAudio]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    }
  }, []);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setCurrentSectionIndex(0);
  }, [stopAudio]);

  const nextSection = useCallback(() => {
    if (currentSectionIndex < sections.length - 1) {
      stopAudio();
      const nextIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIndex);
      onSectionChange?.(nextIndex);
      if (isPlaying) {
        isCancelledRef.current = false;
        speakSection(nextIndex);
      }
    }
  }, [currentSectionIndex, sections.length, isPlaying, speakSection, onSectionChange, stopAudio]);

  const reset = useCallback(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setCurrentSectionIndex(0);
    setMode("read");
  }, [stopAudio]);

  const toggleMode = useCallback((newMode: "read" | "listen") => {
    if (newMode === "read" && mode === "listen") {
      stop();
    }
    setMode(newMode);
  }, [mode, stop]);

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      stopAudio();
    };
  }, [stopAudio]);

  useEffect(() => {
    isCancelledRef.current = true;
    stopAudio();
    setIsPlaying(false);
    setCurrentSectionIndex(0);
  }, [sections, stopAudio]);

  return {
    isPlaying,
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
  };
}
