import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCopilot } from "./CopilotContext";
import { ChefCapIcon } from "./ChefCapIcon";
import { startCopilotIntro } from "./CopilotCommandRegistry";
import { ttsService, TTSCallbacks } from "@/lib/tts";
import { useCopilotGuidedMode } from "./CopilotGuidedModeContext";
import { isDoItYourselfMode, isAutoplayEnabled } from "./CopilotRespectGuard";

export const CopilotSheet: React.FC = () => {
  const { isOpen, close, mode, setMode, lastResponse, suggestions, runAction, setLastResponse } = useCopilot();
  const { isGuidedModeEnabled, toggleGuidedMode } = useCopilotGuidedMode();
  
  // Check if auto-open is truly armed (autoplay ON + not in DIY mode)
  // Use lazy initialization to read localStorage BEFORE first render (production fix)
  const [isAutoArmed, setIsAutoArmed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isAutoplayEnabled() && !isDoItYourselfMode();
  });
  
  // Keep isAutoArmed in sync with context changes
  useEffect(() => {
    const armed = isGuidedModeEnabled && !isDoItYourselfMode();
    setIsAutoArmed(armed);
  }, [isGuidedModeEnabled, isOpen]);

  // =========================================
  // AUDIO - Visual-First with Graceful Degradation
  // ElevenLabs → Browser SpeechSynthesis → Silent Mode
  // Apple App Store Ready - Works 100% offline
  // =========================================
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // =========================================
  // AUTO-CLOSE TIMERS - Separate refs for text-mode and audio-mode
  // =========================================
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null);  // Text-first reading timeout
  const audioCloseTimerRef = useRef<NodeJS.Timeout | null>(null);  // Post-audio close delay
  const audioSafetyTimerRef = useRef<NodeJS.Timeout | null>(null);  // Audio stall watchdog
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Clear text-mode reading timer only
  const clearReadingTimer = useCallback(() => {
    if (readingTimerRef.current) {
      clearTimeout(readingTimerRef.current);
      readingTimerRef.current = null;
    }
  }, []);
  
  // Clear audio-related timers
  const clearAudioTimers = useCallback(() => {
    if (audioCloseTimerRef.current) {
      clearTimeout(audioCloseTimerRef.current);
      audioCloseTimerRef.current = null;
    }
    if (audioSafetyTimerRef.current) {
      clearTimeout(audioSafetyTimerRef.current);
      audioSafetyTimerRef.current = null;
    }
  }, []);
  
  // Clear all auto-close timers (for cleanup)
  const clearAutoCloseTimers = useCallback(() => {
    clearReadingTimer();
    clearAudioTimers();
  }, [clearReadingTimer, clearAudioTimers]);
  
  // Handle audio completion - schedule auto-close
  const handleAudioComplete = useCallback(() => {
    setIsAudioPlaying(false);
    clearAudioTimers(); // Only clear audio timers, not reading timer
    
    // Only auto-close if response has autoClose flag (page explanations)
    if (lastResponse?.autoClose) {
      // Small delay after audio ends before closing (feels more natural)
      audioCloseTimerRef.current = setTimeout(() => {
        close();
      }, 1500);
    }
  }, [lastResponse?.autoClose, close, clearAudioTimers]);
  
  // Handle audio start - set up safety timeout based on text length
  const handleAudioStart = useCallback(() => {
    setIsAudioPlaying(true);
    clearReadingTimer(); // Stop reading timer when audio starts
    clearAudioTimers(); // Clear any previous audio timers
    
    // Dynamic safety timeout: calculate based on word count
    // Formula: (words * 500ms at 0.95 rate) + 15s buffer for API latency
    // This ensures even long explanations have time to complete
    if (lastResponse?.autoClose && lastResponse?.spokenText) {
      const wordCount = lastResponse.spokenText.split(/\s+/).length;
      const estimatedDuration = (wordCount * 500) + 15000; // 500ms per word + 15s buffer
      const safetyTimeout = Math.max(30000, estimatedDuration); // Minimum 30 seconds
      
      audioSafetyTimerRef.current = setTimeout(() => {
        console.log('[Copilot] Safety timeout - auto-closing sheet after', safetyTimeout, 'ms');
        setIsAudioPlaying(false);
        close();
      }, safetyTimeout);
    }
  }, [lastResponse?.autoClose, lastResponse?.spokenText, close, clearReadingTimer, clearAudioTimers]);

  // =========================================
  // TEXT-FIRST: Auto-close for responses without audio
  // Closes after a reading timeout when autoClose is set
  // =========================================
  useEffect(() => {
    if (!lastResponse?.autoClose || !lastResponse?.spokenText) return;
    
    // Don't set reading timer if user is listening to audio (audio timer takes over)
    if (isAudioPlaying) {
      return; // Don't clear anything - audio timers are in control
    }
    
    // Clear previous reading timer before setting new one
    clearReadingTimer();
    
    // Calculate reading time: ~200 WPM = 300ms per word, plus 3s buffer
    const wordCount = lastResponse.spokenText.split(/\s+/).length;
    const readingTimeMs = Math.max(5000, (wordCount * 300) + 3000);
    
    readingTimerRef.current = setTimeout(() => {
      console.log('[Copilot] Text-first auto-close after reading time:', readingTimeMs, 'ms');
      close();
    }, readingTimeMs);
    
    return () => {
      clearReadingTimer();
    };
  }, [lastResponse?.autoClose, lastResponse?.spokenText, isAudioPlaying, close, clearReadingTimer]);

  // =========================================
  // TEXT-FIRST: On-demand TTS (user taps "Listen" button)
  // No auto-play - user must explicitly request audio
  // =========================================
  const handleListenToResponse = useCallback(async () => {
    if (!lastResponse?.spokenText) return;
    
    try {
      setIsAudioPlaying(true);
      
      const callbacks: TTSCallbacks = {
        onStart: handleAudioStart,
        onEnd: handleAudioComplete,
        onError: (error) => {
          console.warn('[TTS] Audio error:', error);
          handleAudioComplete();
        }
      };
      
      const result = await ttsService.speak(lastResponse.spokenText, callbacks);

      if (result.audioUrl) {
        setAudioUrl(prevUrl => {
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          return result.audioUrl!;
        });
      }
    } catch (err: any) {
      console.error("TTS error:", err);
      setIsAudioPlaying(false);
    }
  }, [lastResponse?.spokenText, handleAudioStart, handleAudioComplete]);

  // Cleanup on unmount or when sheet closes
  useEffect(() => {
    return () => {
      ttsService.stop();
      clearAutoCloseTimers();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [clearAutoCloseTimers]);

  // =========================================
  // STOP AUDIO when Auto toggle is turned OFF
  // This is a GLOBAL preference - stops audio but also disables future autoplay
  // =========================================
  useEffect(() => {
    if (!isGuidedModeEnabled) {
      // Stop TTS service
      ttsService.stop();
      // Stop HTML audio element
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Clean up audio URL
      setAudioUrl(prevUrl => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
      setIsAudioPlaying(false);
      clearAutoCloseTimers();
    }
  }, [isGuidedModeEnabled, clearAutoCloseTimers]);

  // =========================================
  // SKIP CURRENT EXPLANATION - Stops audio but KEEPS autoplay enabled
  // This allows skipping the current page without affecting future pages
  // =========================================
  const handleSkipExplanation = useCallback(() => {
    // Stop TTS service
    ttsService.stop();
    // Stop HTML audio element
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Clean up audio URL
    setAudioUrl(prevUrl => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
    setIsAudioPlaying(false);
    clearAutoCloseTimers();
    // Close the sheet - autoplay preference stays untouched
    close();
  }, [clearAutoCloseTimers, close]);

  // =========================================
  // AUTOPLAY HANDLING - Retry with manual play if autoPlay blocked
  // Browsers often block autoPlay, so we manually trigger play() as fallback
  // =========================================
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    // Wait for element to be ready, then try manual play as fallback for autoPlay blocking
    requestAnimationFrame(async () => {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        await audio.play();
        setAudioBlocked(false); // Successfully playing
      } catch (err: any) {
        // autoPlay blocked - show tap-to-play prompt
        if (err.name === "NotAllowedError") {
          console.log("🔇 Autoplay blocked, showing tap-to-play prompt");
          setAudioBlocked(true);
        } else {
          console.error("Audio playback error:", err);
        }
      }
    });
  }, [audioUrl]);

  // Manual play handler for tap-to-play fallback
  const handleTapToPlay = async () => {
    if (!audioRef.current) return;
    
    try {
      await audioRef.current.play();
      setAudioBlocked(false); // Hide prompt after successful play
    } catch (err: any) {
      console.error("Manual audio play failed:", err);
    }
  };

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  PROTECTED INVARIANT: Stop ALL active sessions when sheet closes      ║
  // ║  This includes: audio playback and pending timers                     ║
  // ║  DO NOT REMOVE - ensures clean state on close                         ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    if (!isOpen) {
      // Stop audio playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setAudioUrl(prevUrl => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
      setAudioBlocked(false);
      setIsAudioPlaying(false);
      
      // CRITICAL: Clear all auto-close timers when user manually closes
      clearAutoCloseTimers();
      
      setMode("idle");
    }
  }, [isOpen, setMode, clearAutoCloseTimers]);

  // =========================================
  // COPILOT INTRO - Trigger when user chooses "My Perfect Copilot"
  // =========================================
  useEffect(() => {
    if (isOpen) {
      const triggerFlag = localStorage.getItem("trigger-copilot-intro");
      
      if (triggerFlag === "true") {
        // Remove trigger flag
        localStorage.removeItem("trigger-copilot-intro");
        
        // Play intro (force=true to ignore "already seen" flag)
        setTimeout(() => {
          startCopilotIntro(true);
        }, 500); // Small delay to ensure sheet is fully open
      }
    }
  }, [isOpen]);

  // Voice and text input removed - Copilot is now tap-to-action only
  // Users interact via the suggestion tiles below

  // =========================================
  // WALKTHROUGH STATE
  // =========================================
  const isWalkthrough = lastResponse?.type === "walkthrough";
  const walkthroughSteps = isWalkthrough ? lastResponse.steps : [];
  const [wtIndex, setWtIndex] = useState(0);

  useEffect(() => {
    if (isWalkthrough) setWtIndex(0);
  }, [isWalkthrough]);

  const currentStep = isWalkthrough && walkthroughSteps ? walkthroughSteps[wtIndex] : null;

  const nextStep = () => {
    if (!isWalkthrough || !walkthroughSteps) return;

    const next = wtIndex + 1;
    if (next < walkthroughSteps.length) {
      setWtIndex(next);
    } else {
      setLastResponse(null);
      setWtIndex(0);
    }
  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          {/* Bottom Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="mx-auto mb-2 w-full max-w-xl px-3">
              <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-slate-950/95 via-black/95 to-slate-900/90 backdrop-blur-2xl shadow-2xl shadow-black/60">
                {/* Handle */}
                <div className="flex justify-center pt-3">
                  <div className="h-1 w-10 rounded-full bg-white/15" />
                </div>

                {/* Header - Compact with Close button */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChefCapIcon size={28} />
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-[0.16em] text-orange-300/90">
                          My Perfect Meals Copilot
                        </span>
                        <span className="text-xs text-white/60">
                          {mode === "thinking"
                            ? "Processing..."
                            : "Tap an option below"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Autoplay Toggle - Controls auto-open on page navigation only */}
                      {/* AUTO label glows when auto-open is truly armed */}
                      <span className={`text-[9px] transition-all duration-200 ${
                        isAutoArmed 
                          ? "text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" 
                          : "text-white/50"
                      }`}>Auto</span>
                      <button
                        onClick={toggleGuidedMode}
                        aria-pressed={isGuidedModeEnabled}
                        aria-label={`Autoplay ${isGuidedModeEnabled ? "on" : "off"}`}
                        className={`
                          !min-h-0 !min-w-0 inline-flex items-center justify-center
                          px-3 py-px min-w-[32px] rounded-full
                          text-[7px] font-semibold uppercase tracking-wide
                          transition-all duration-150 ease-out whitespace-nowrap
                          ${isGuidedModeEnabled
                            ? "bg-emerald-600/80 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] border border-emerald-400/40"
                            : "bg-amber-500/20 text-amber-200 shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:bg-amber-500/30 border border-amber-400/40"
                          }
                        `}
                      >
                        {isGuidedModeEnabled ? "On" : "Off"}
                      </button>
                      <button
                        onClick={close}
                        className="rounded-full bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input removed - Copilot is now tap-to-action only */}

                {/* Audio status indicator with Skip button - shows when audio is playing */}
                {isAudioPlaying && (
                  <div className="px-4 pt-2">
                    <div className="rounded-xl bg-orange-500/10 border border-orange-400/30 px-3 py-2 flex items-center justify-between">
                      <p className="text-xs text-orange-300/90 animate-pulse">
                        🔊 Playing...
                      </p>
                      <button
                        onClick={handleSkipExplanation}
                        className="!min-h-0 !min-w-0 px-3 py-1 rounded-full bg-white/10 text-[10px] font-medium text-white/80 hover:bg-white/20 transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio Player - ElevenLabs audio with auto-close wiring */}
                {audioUrl && (
                  <audio 
                    ref={audioRef}
                    autoPlay
                    src={audioUrl}
                    onPlay={handleAudioStart}
                    onEnded={() => {
                      // Clean up URL
                      setAudioUrl(prevUrl => {
                        if (prevUrl) {
                          URL.revokeObjectURL(prevUrl);
                        }
                        return null;
                      });
                      // Trigger auto-close logic
                      handleAudioComplete();
                    }}
                    onError={() => {
                      // Audio failed to play - treat as completion
                      handleAudioComplete();
                    }}
                  />
                )}

                {/* ============================
                    WALKTHROUGH MODE
                ============================= */}
                {isWalkthrough && currentStep && (
                  <div className="mt-3 px-4 pb-2">
                    <div className="rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4">
                      <button
                        onClick={() => {
                          setLastResponse(null);
                          setWtIndex(0);
                        }}
                        className="float-right text-xs text-white/40 hover:text-white/70"
                      >
                        ✕
                      </button>
                      <h2 className="text-lg font-semibold mb-1 text-white">{lastResponse.title}</h2>
                      <p className="text-white/80 text-xs mb-4">Step {wtIndex + 1} of {walkthroughSteps?.length || 0}</p>

                      <p className="text-white/90 text-base mb-4">{currentStep.text}</p>

                      {currentStep.targetId && (
                        <p className="text-xs text-orange-400/80 mb-4 italic">
                          💡 Look for: {currentStep.targetId}
                        </p>
                      )}

                      <button
                        onClick={nextStep}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-md ${
                          wtIndex === (walkthroughSteps?.length || 0) - 1
                            ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                            : "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400"
                        }`}
                      >
                        {wtIndex === (walkthroughSteps?.length || 0) - 1 ? "✓ Finish Walkthrough" : "Next Step →"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ============================
                    FEATURE / KNOWLEDGE MODE
                ============================= */}
                {!isWalkthrough && lastResponse?.title && (
                  <div className="mt-3 px-4 pb-2">
                    <div className="rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h2 className="text-lg font-semibold text-white">{lastResponse.title}</h2>
                        <div className="flex items-center gap-2">
                          {/* Listen Button - On-demand TTS */}
                          {lastResponse.spokenText && (
                            <button
                              onClick={handleListenToResponse}
                              disabled={isAudioPlaying}
                              className={`text-xs px-2 py-1 rounded-full transition-all ${
                                isAudioPlaying
                                  ? "bg-orange-500/50 text-white"
                                  : "bg-orange-500/40 text-white border-2 border-orange-400 hover:bg-orange-500/60 animate-pulse"
                              }`}
                              title="Listen to response"
                            >
                              {isAudioPlaying ? "🔊 Playing..." : "🔊 Listen"}
                            </button>
                          )}
                          <button
                            onClick={() => setLastResponse(null)}
                            className="text-xs text-white/40 hover:text-white/70"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-white/80 text-sm mb-3">{lastResponse.description}</p>

                      {lastResponse.howTo && lastResponse.howTo.length > 0 && (
                        <div className="mb-4">
                          <p className="text-white/90 font-semibold mb-1 text-sm">How to Use:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {lastResponse.howTo.map((step, i) => (
                              <li key={i} className="text-white/70 text-xs">{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lastResponse.tips && lastResponse.tips.length > 0 && (
                        <div>
                          <p className="text-white/90 font-semibold mb-1 text-sm">Tips:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {lastResponse.tips.map((tip, i) => (
                              <li key={i} className="text-white/70 text-xs">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================
                    BASE SUGGESTIONS MODE
                ============================= */}
                {!lastResponse && (
                  <div className="mt-3 max-h-60 space-y-1 overflow-y-auto px-2 pb-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setMode("thinking");
                          runAction(s.action);
                        }}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/3 px-3 py-2 text-left hover:border-orange-400/50 hover:bg-orange-500/5"
                      >
                        <div className="mt-1 h-6 w-6 flex-shrink-0 rounded-full bg-black/60 text-[11px] font-semibold uppercase tracking-wide text-orange-300 flex items-center justify-center border border-orange-400/40">
                          {s.badge ? s.badge.charAt(0) : "AI"}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">
                              {s.label}
                            </span>
                            {s.badge && (
                              <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-orange-300">
                                {s.badge}
                              </span>
                            )}
                          </div>
                          {s.description && (
                            <span className="mt-0.5 text-[11px] text-white/60">
                              {s.description}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-white/40 group-hover:text-orange-300">
                          •••
                        </div>
                      </button>
                    ))}

                    {suggestions.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-white/60">
                        No actions available on this page.
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom padding for safe area */}
                <div className="h-2" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
