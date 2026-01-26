import { useState, useRef, useCallback, useEffect } from "react";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { VoiceEngine, VoiceState, CollectedData, VOICE_CONFIG } from "./VoiceEngine";
import { getStudioScript } from "./StudioScripts";
import type { StudioType } from "./StudioScripts";

interface UseTalkToChefOptions {
  studioType: StudioType;
  onReadyToGenerate: (data: CollectedData) => void;
  onError?: (error: string) => void;
}

interface UseTalkToChefReturn {
  isActive: boolean;
  voiceState: VoiceState;
  transcript: string;
  startTalking: () => Promise<boolean>;
  stopTalking: () => void;
  permissionDenied: boolean;
}

export function useTalkToChef({
  studioType,
  onReadyToGenerate,
  onError,
}: UseTalkToChefOptions): UseTalkToChefReturn {
  const [isActive, setIsActive] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);
  
  const engineRef = useRef<VoiceEngine | null>(null);

  const handleChefSpeak = useCallback(async (text: string): Promise<void> => {
    await speak(text);
  }, [speak]);

  const handleChefStop = useCallback(() => {
    stopChef();
  }, [stopChef]);

  const startTalking = useCallback(async (): Promise<boolean> => {
    if (isActive) return true;
    
    setPermissionDenied(false);
    setTranscript("");
    
    const script = getStudioScript(studioType);
    
    const engine = new VoiceEngine(
      script,
      {
        onStateChange: (state) => {
          setVoiceState(state);
          if (state === "idle") {
            setIsActive(false);
          }
        },
        onTranscript: (text, isFinal) => {
          setTranscript(text);
        },
        onChefSpeak: handleChefSpeak,
        onChefStop: handleChefStop,
        onReadyToGenerate: (data) => {
          setIsActive(false);
          setVoiceState("idle");
          onReadyToGenerate(data);
        },
        onError: (error) => {
          console.error("TalkToChef error:", error);
          onError?.(error);
        },
        onPermissionDenied: () => {
          setPermissionDenied(true);
          setIsActive(false);
          setVoiceState("idle");
        },
      },
      VOICE_CONFIG
    );
    
    engineRef.current = engine;
    setIsActive(true);
    
    const started = await engine.start();
    if (!started) {
      setIsActive(false);
      return false;
    }
    
    return true;
  }, [isActive, studioType, handleChefSpeak, handleChefStop, onReadyToGenerate, onError]);

  const stopTalking = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    setIsActive(false);
    setVoiceState("idle");
    setTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, []);

  return {
    isActive,
    voiceState,
    transcript,
    startTalking,
    stopTalking,
    permissionDenied,
  };
}
