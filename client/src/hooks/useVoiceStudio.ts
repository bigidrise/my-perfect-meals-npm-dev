import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { iosAudioSession } from "@/lib/iosAudioSession";
import { createSpeechRecognition, requestSpeechPermissions } from "@/lib/speechRecognition";

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
  const speechEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const currentVoiceStepRef = useRef(0);
  const gotResultRef = useRef(false);
  const restartCountRef = useRef(0);
  const listenStartedAtRef = useRef(0);
  const accumulatedTranscriptRef = useRef("");
  
  const MAX_RESTARTS = 5;
  const MIN_LISTEN_MS = 1200;
  const SPEECH_END_DELAY = 2000; // Wait 2s after last speech before processing

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

  const clearSpeechEndTimeout = useCallback(() => {
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimeout();
    clearSpeechEndTimeout();
    accumulatedTranscriptRef.current = "";
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }, [clearSilenceTimeout, clearSpeechEndTimeout]);

  const endSession = useCallback(() => {
    setIsActive(false);
    setVoiceState("idle");
    stopListening();
    stopChef();
    setSilenceCount(0);
  }, [stopListening, stopChef]);

  const processTranscript = useCallback((transcript: string) => {
    if (!isActiveRef.current || !transcript.trim()) return;
    
    console.log("🎤 Processing final transcript:", transcript);
    setLastTranscript(transcript);
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
  }, [steps, setStudioStep, onAllStepsComplete, speak, stopListening]);

  const startListening = useCallback(async () => {
    if (!isActiveRef.current) return;

    const isNative = Capacitor.isNativePlatform();
    
    // iOS: Reset audio session to switch from output to input mode (only for web fallback)
    if (!isNative) {
      await iosAudioSession.resetForInput();
    }

    console.log("🎤 Starting speech recognition... (native:", isNative, ")");
    setVoiceState("listening");
    gotResultRef.current = false;
    listenStartedAtRef.current = Date.now();
    accumulatedTranscriptRef.current = "";

    // Create unified speech recognition (works on both iOS native and web)
    const recognition = createSpeechRecognition(
      // onResult callback
      (transcript: string, isFinal: boolean) => {
        clearSilenceTimeout();
        clearSpeechEndTimeout();
        
        accumulatedTranscriptRef.current = transcript;
        console.log("🎤 Transcript update:", transcript, "isFinal:", isFinal);
        gotResultRef.current = true;
        restartCountRef.current = 0;
        
        // Reset silence timer when we get any speech
        silenceTimeoutRef.current = setTimeout(() => {
          if (!isActiveRef.current) return;
          recognitionRef.current?.stop();
          handleSilenceTimeout();
        }, 10000);
        
        // If this is a final result (native plugin stopped), process immediately
        if (isFinal && transcript.trim()) {
          processTranscript(transcript.trim());
        } else if (transcript.trim()) {
          // For web: wait for user to stop talking (2s pause)
          speechEndTimeoutRef.current = setTimeout(() => {
            if (!isActiveRef.current) return;
            processTranscript(accumulatedTranscriptRef.current.trim());
          }, SPEECH_END_DELAY);
        }
      },
      // onError callback
      (error: string) => {
        console.error("🎤 Speech recognition error:", error);
        clearSilenceTimeout();
        clearSpeechEndTimeout();
        
        if ((error === "no-speech" || error === "aborted") && isActiveRef.current) {
          handleSilenceTimeout();
        } else if (error === "not-allowed" || error === "unsupported") {
          speak("Speech recognition is not available. Please continue manually.").then(() => {
            endSession();
          }).catch(() => {
            endSession();
          });
        }
      },
      // onEnd callback
      () => {
        const duration = Date.now() - listenStartedAtRef.current;
        console.log("🎤 Speech recognition ended, gotResult:", gotResultRef.current, "duration:", duration + "ms");
        clearSilenceTimeout();
        
        // If still active but no result was captured, consider auto-restart
        if (isActiveRef.current && !gotResultRef.current) {
          restartCountRef.current++;
          
          if (restartCountRef.current > MAX_RESTARTS) {
            console.warn("🎤 Voice failed repeatedly, falling back to manual mode");
            speak("Having trouble hearing you. Please continue manually.").then(() => {
              endSession();
            }).catch(() => {
              endSession();
            });
            return;
          }
          
          const delay = duration < MIN_LISTEN_MS ? 200 : 300;
          console.log(`🎤 No result captured (attempt ${restartCountRef.current}/${MAX_RESTARTS}), restarting in ${delay}ms...`);
          
          setTimeout(() => {
            if (isActiveRef.current) {
              startListening();
            }
          }, delay);
        }
      }
    );

    recognitionRef.current = recognition;
    const started = await recognition.start();
    
    if (!started) {
      console.error("🎤 Failed to start speech recognition");
      return;
    }

    // Set initial silence timeout (10 seconds)
    silenceTimeoutRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;
      stopListening();
      handleSilenceTimeout();
    }, 10000);
  }, [clearSilenceTimeout, clearSpeechEndTimeout, processTranscript, speak, stopListening, endSession]);

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
    // Request speech permissions (works on both iOS native and web)
    const hasPermission = await requestSpeechPermissions();
    if (!hasPermission) {
      console.error("🎤 Speech recognition permission denied");
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
