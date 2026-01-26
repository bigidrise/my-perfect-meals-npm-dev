import { useState, useRef, useCallback, useEffect } from "react";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { iosAudioSession } from "@/lib/iosAudioSession";

interface VoiceStudioStep {
  voiceScript: string;
  setValue: (value: string) => void;
  setLocked: (locked: boolean) => void;
  setListened: (listened: boolean) => void;
  parseValue?: (transcript: string) => string;
}

interface UseVoiceStudioOptions {
  steps: VoiceStudioStep[];
  onAllStepsComplete: (collectedValues: string[]) => void;
  setStudioStep: (step: number) => void;
  disabledSteps?: number[];
}

type VoiceState = "idle" | "speaking" | "listening" | "processing";

export function useVoiceStudio({
  steps,
  onAllStepsComplete,
  setStudioStep,
  disabledSteps = [],
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
  const gotResultRef = useRef(false);
  const restartCountRef = useRef(0);
  const listenStartedAtRef = useRef(0);
  
  // Track collected values across all steps to avoid React state timing issues
  const collectedValuesRef = useRef<string[]>([]);
  
  const MAX_RESTARTS = 3;
  const MIN_LISTEN_MS = 1200;

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

  const startListening = useCallback(async () => {
    if (!isActiveRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("🎤 Speech recognition not supported in this browser");
      return;
    }

    // iOS: Reset audio session to switch from output to input mode
    await iosAudioSession.resetForInput();

    console.log("🎤 Starting speech recognition...");
    setVoiceState("listening");
    gotResultRef.current = false;
    listenStartedAtRef.current = Date.now();

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
      gotResultRef.current = true;
      restartCountRef.current = 0; // Reset on success
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
      
      // Store collected value in ref (avoids React state timing issues)
      collectedValuesRef.current[stepIndex] = value;
      console.log("🎤 Stored value for step", stepIndex, ":", value);

      // Lock current step first
      step.setListened(true);
      step.setLocked(true);
      step.setValue(value);

      const nextStepIndex = stepIndex + 1;
      
      // Update studio step (1-indexed: step 0 complete -> studioStep 2, etc.)
      setStudioStep(nextStepIndex + 1);

      if (nextStepIndex >= steps.length) {
        // All steps complete - pass collected values to callback
        const finalValues = [...collectedValuesRef.current];
        console.log("🎤 All steps complete, collected values:", finalValues);
        setVoiceState("speaking");
        speak("Got it. Building your meal now.").then(() => {
          setIsActive(false);
          setVoiceState("idle");
          onAllStepsComplete(finalValues);
        }).catch(() => {
          setIsActive(false);
          setVoiceState("idle");
          onAllStepsComplete(finalValues);
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
      const duration = Date.now() - listenStartedAtRef.current;
      console.log("🎤 Speech recognition ended, gotResult:", gotResultRef.current, "duration:", duration + "ms");
      clearSilenceTimeout();
      
      // If still active but no result was captured, consider auto-restart
      if (isActiveRef.current && !gotResultRef.current) {
        restartCountRef.current++;
        
        // Max restart guard - prevent infinite loops
        if (restartCountRef.current > MAX_RESTARTS) {
          console.warn("🎤 Voice failed repeatedly, falling back to manual mode");
          speak("Having trouble hearing you. Please continue manually.").then(() => {
            endSession();
          }).catch(() => {
            endSession();
          });
          return;
        }
        
        // Minimum listen window - restart faster if ended too quickly
        const delay = duration < MIN_LISTEN_MS ? 200 : 300;
        console.log(`🎤 No result captured (attempt ${restartCountRef.current}/${MAX_RESTARTS}), restarting in ${delay}ms...`);
        
        setTimeout(() => {
          if (isActiveRef.current) {
            startListening();
          }
        }, delay);
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

  const startVoiceMode = useCallback(async (fromStepIndex?: number) => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone permission denied:", err);
      return false;
    }

    // Find first non-disabled step (starting from fromStepIndex if provided)
    const searchStart = fromStepIndex ?? 0;
    let firstEnabledStep = searchStart;
    for (let i = searchStart; i < steps.length; i++) {
      if (!disabledSteps.includes(i)) {
        firstEnabledStep = i;
        break;
      }
    }

    // If all remaining steps are disabled, don't start voice mode
    if (disabledSteps.includes(firstEnabledStep)) {
      console.log("🎤 All steps are disabled for voice, not starting");
      return false;
    }

    setIsActive(true);
    setCurrentVoiceStep(firstEnabledStep);
    setLastTranscript("");
    setSilenceCount(0);
    restartCountRef.current = 0;
    collectedValuesRef.current = []; // Reset collected values for new session
    
    // Set studio to the enabled step (1-indexed)
    setStudioStep(firstEnabledStep + 1);
    
    // Speak first enabled step
    speakStepWithCallback(firstEnabledStep);
    return true;
  }, [setStudioStep, speakStepWithCallback, steps.length, disabledSteps]);

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
