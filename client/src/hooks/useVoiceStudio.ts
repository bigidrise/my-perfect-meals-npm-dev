import { useState, useRef, useCallback, useEffect } from "react";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";

interface VoiceStudioStep {
  voiceScript: string;
  setValue: (value: string) => void;
  setLocked: (locked: boolean) => void;
  setListened: (listened: boolean) => void;
  parseValue?: (transcript: string) => string;
}

interface UseVoiceStudioOptions {
  steps: VoiceStudioStep[];
  onAllStepsComplete: () => void;
  setStudioStep: (step: number) => void;
}

type VoiceState = "idle" | "speaking" | "listening" | "processing";

export function useVoiceStudio({
  steps,
  onAllStepsComplete,
  setStudioStep,
}: UseVoiceStudioOptions) {
  const [isActive, setIsActive] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentVoiceStep, setCurrentVoiceStep] = useState(0);
  const [lastTranscript, setLastTranscript] = useState("");
  const [silenceCount, setSilenceCount] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);

  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const currentVoiceStepRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    currentVoiceStepRef.current = currentVoiceStep;
  }, [currentVoiceStep]);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimeout();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }, [clearSilenceTimeout]);

  const endSession = useCallback(() => {
    setIsActive(false);
    setVoiceState("idle");
    stopListening();
    stopChef();
    setSilenceCount(0);
  }, [stopListening, stopChef]);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("🎤 Speech recognition not supported in this browser");
      return;
    }

    console.log("🎤 Starting speech recognition...");
    setVoiceState("listening");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("🎤 Speech recognition started - listening now");
    };

    recognition.onaudiostart = () => {
      console.log("🎤 Audio capture started");
    };

    recognition.onsoundstart = () => {
      console.log("🎤 Sound detected");
    };

    recognition.onspeechstart = () => {
      console.log("🎤 Speech detected");
    };

    recognition.onresult = (event: any) => {
      console.log("🎤 Got result:", event.results[0][0].transcript);
      const transcript = event.results[0][0].transcript;
      setLastTranscript(transcript);
      clearSilenceTimeout();
      setSilenceCount(0);
      
      // Process the transcript
      setVoiceState("processing");
      stopListening();

      const stepIndex = currentVoiceStepRef.current;
      const step = steps[stepIndex];
      if (!step) return;

      const value = step.parseValue ? step.parseValue(transcript) : transcript;

      // Lock current step first
      step.setListened(true);
      step.setLocked(true);
      step.setValue(value);

      const nextStepIndex = stepIndex + 1;
      
      // Update studio step (1-indexed: step 0 complete -> studioStep 2, etc.)
      setStudioStep(nextStepIndex + 1);

      if (nextStepIndex >= steps.length) {
        // All steps complete
        setVoiceState("speaking");
        speak("Got it. Building your meal now.").then(() => {
          setIsActive(false);
          setVoiceState("idle");
          onAllStepsComplete();
        }).catch(() => {
          setIsActive(false);
          setVoiceState("idle");
          onAllStepsComplete();
        });
      } else {
        // Move to next step and speak
        setCurrentVoiceStep(nextStepIndex);
        speakStepWithCallback(nextStepIndex);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      clearSilenceTimeout();
      
      if (event.error === "no-speech" && isActiveRef.current) {
        handleSilenceTimeout();
      }
    };

    recognition.onend = () => {
      console.log("🎤 Speech recognition ended");
      clearSilenceTimeout();
      
      // If still active but no result was captured, auto-restart listening
      if (isActiveRef.current && voiceState === "listening") {
        console.log("🎤 No result captured, restarting listening...");
        setTimeout(() => {
          if (isActiveRef.current) {
            startListening();
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Set silence timeout (7 seconds)
    silenceTimeoutRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;
      stopListening();
      handleSilenceTimeout();
    }, 7000);
  }, [clearSilenceTimeout, steps, setStudioStep, onAllStepsComplete, speak, stopListening]);

  const handleSilenceTimeout = useCallback(() => {
    setSilenceCount((prev) => {
      const newCount = prev + 1;
      
      if (newCount >= 2) {
        // Second silence - end session gracefully
        setVoiceState("speaking");
        speak("No worries. Come back when you're ready.").then(() => {
          endSession();
        }).catch(() => {
          endSession();
        });
      } else {
        // First silence - nudge
        setVoiceState("speaking");
        speak("Still there? Take your time.").then(() => {
          if (isActiveRef.current) {
            startListening();
          }
        }).catch(() => {
          if (isActiveRef.current) {
            startListening();
          }
        });
      }
      
      return newCount;
    });
  }, [speak, endSession, startListening]);

  const speakStepWithCallback = useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex];
      if (!step) return;

      setVoiceState("speaking");
      
      // Mark step as listened when Chef starts speaking
      step.setListened(true);
      
      // Use speak and wait for it to complete before listening
      speak(step.voiceScript).then(() => {
        // Small delay after TTS ends before starting to listen
        setTimeout(() => {
          if (isActiveRef.current) {
            startListening();
          }
        }, 300);
      }).catch(() => {
        // Even on error, try to start listening
        setTimeout(() => {
          if (isActiveRef.current) {
            startListening();
          }
        }, 300);
      });
    },
    [steps, speak, startListening]
  );

  const startVoiceMode = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone permission denied:", err);
      return false;
    }

    setIsActive(true);
    setCurrentVoiceStep(0);
    setLastTranscript("");
    setSilenceCount(0);
    
    // Set studio to step 1 (1-indexed)
    setStudioStep(1);
    
    // Speak first step
    speakStepWithCallback(0);
    return true;
  }, [setStudioStep, speakStepWithCallback]);

  const stopVoiceMode = useCallback(() => {
    endSession();
  }, [endSession]);

  useEffect(() => {
    return () => {
      stopListening();
      stopChef();
    };
  }, [stopListening, stopChef]);

  return {
    isActive,
    voiceState,
    currentVoiceStep,
    lastTranscript,
    isPlaying,
    startVoiceMode,
    stopVoiceMode,
  };
}
