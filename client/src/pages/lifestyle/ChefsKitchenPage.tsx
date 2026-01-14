import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, UtensilsCrossed } from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { ttsService } from "@/lib/tts";
import {
  KITCHEN_STUDIO_INTRO,
  KITCHEN_STUDIO_STEP2,
  KITCHEN_STUDIO_COOK_METHOD,
  KITCHEN_STUDIO_COOK_CONFIRMED,
} from "@/components/copilot/scripts/kitchenStudioScripts";

type KitchenMode = "entry" | "studio";

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("chefs-kitchen");
  const [mode, setMode] = useState<KitchenMode>("entry");

  // Kitchen Studio state
  const [studioStep, setStudioStep] = useState<1 | 2 | 3>(1);
  const [dishIdea, setDishIdea] = useState("");
  const [hasListened, setHasListened] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Step 2 state
  const [cookMethod, setCookMethod] = useState("");
  const [hasListenedStep2, setHasListenedStep2] = useState(false);
  const [isLockedStep2, setIsLockedStep2] = useState(false);

  // Voice handler - same pattern as ProTip
  const handleListenToChef = useCallback(async () => {
    if (hasListened || isPlaying) return;

    setIsPlaying(true);

    try {
      ttsService.stop();
      const result = await ttsService.speak(KITCHEN_STUDIO_INTRO, {
        onStart: () => {
          setIsPlaying(true);
          setHasListened(true);
        },
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
      setHasListened(true);
    }
  }, [hasListened, isPlaying]);

  // Voice handler for step 2 transition
  const handleSubmitDishIdea = useCallback(async () => {
    if (!dishIdea.trim()) return;

    setIsLocked(true);
    setStudioStep(2);

    try {
      ttsService.stop();
      const result = await ttsService.speak(KITCHEN_STUDIO_STEP2, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  }, [dishIdea]);

  // Voice handler for step 2 - cooking method
  const handleListenCookMethod = useCallback(async () => {
    if (hasListenedStep2 || isPlaying) return;

    setIsPlaying(true);

    try {
      ttsService.stop();
      const result = await ttsService.speak(KITCHEN_STUDIO_COOK_METHOD, {
        onStart: () => {
          setIsPlaying(true);
          setHasListenedStep2(true);
        },
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
      setHasListenedStep2(true);
    }
  }, [hasListenedStep2, isPlaying]);

  // Voice handler for step 2 submit
  const handleSubmitCookMethod = useCallback(async () => {
    if (!cookMethod) return;

    setIsLockedStep2(true);
    setStudioStep(3);

    try {
      ttsService.stop();
      const result = await ttsService.speak(KITCHEN_STUDIO_COOK_CONFIRMED, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  }, [cookMethod]);

  useEffect(() => {
    document.title = "Chef's Kitchen | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
          {/* Back */}
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            data-testid="button-back-to-lifestyle"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white truncate min-w-0">
            Chef's Kitchen
          </h1>

          <div className="flex-grow" />

          {/* Guided Tour */}
          <QuickTourButton
            onClick={quickTour.openTour}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-2xl mx-auto px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* ENTRY MODE */}
        {mode === "entry" && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                  <h2 className="text-base font-semibold text-white">
                    Kitchen Studio
                  </h2>
                </div>

                <p className="text-sm text-white/80">
                  Create great-tasting, healthy food with AI. This is where
                  ideas turn into dishes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/20">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      What are we cooking today?
                    </h3>
                    <p className="text-xs text-white/70">
                      Start with an idea, a craving, or an ingredient - we'll
                      build it together.
                    </p>
                  </div>
                </div>

                <button
                  className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-600 text-black font-semibold text-sm active:scale-[0.98] transition"
                  data-testid="button-enter-kitchen-studio"
                  onClick={() => setMode("studio")}
                >
                  Enter Kitchen Studio
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STUDIO MODE */}
        {mode === "studio" && (
          <div className="space-y-4">
            {/* Kitchen Studio - Step 1 */}
            {studioStep >= 1 && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                    <h2 className="text-base font-semibold text-white">
                      Kitchen Studio
                    </h2>
                  </div>

                  {/* Locked State (after submit) */}
                  {isLocked ? (
                    <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                      <p className="text-sm text-white/90 font-medium">
                        What are we making today?
                      </p>
                      <p className="text-sm text-white/70 mt-1">{dishIdea}</p>
                    </div>
                  ) : (
                    <>
                      {/* Intro */}
                      <p className="text-sm text-white/80">
                        Ready to cook together? Tap <strong>Listen</strong> to
                        start.
                      </p>

                      {/* Listen Button */}
                      {!hasListened && (
                        <button
                          className={`w-full py-3 rounded-xl border text-white font-medium transition ${
                            isPlaying
                              ? "bg-green-900/40 border-green-500/40"
                              : "bg-black/40 border-white/20 hover:bg-black/50"
                          }`}
                          onClick={handleListenToChef}
                          disabled={isPlaying}
                          data-testid="button-listen-to-chef"
                        >
                          {isPlaying ? "Speaking..." : "Listen to Chef"}
                        </button>
                      )}

                      {/* Input appears AFTER listening */}
                      {hasListened && (
                        <>
                          <div>
                            <label className="block text-sm text-white mb-1">
                              What are we making today?
                            </label>
                            <textarea
                              value={dishIdea}
                              onChange={(e) => setDishIdea(e.target.value)}
                              placeholder="Describe the dish, flavor, or vibe..."
                              className="w-full px-3 py-2 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-20 resize-none text-sm"
                              maxLength={300}
                            />
                            <p className="text-xs text-white/60 mt-1 text-right">
                              {dishIdea.length}/300
                            </p>
                          </div>

                          <button
                            className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm disabled:opacity-50 transition"
                            disabled={!dishIdea.trim() || isPlaying}
                            onClick={handleSubmitDishIdea}
                            data-testid="button-submit-dish-idea"
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ───────── Kitchen Studio – Step 2 ───────── */}
            {studioStep >= 2 && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">
                      Cooking Method
                    </h3>
                  </div>

                  {/* Locked State */}
                  {isLockedStep2 ? (
                    <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                      <p className="text-sm text-white/90 font-medium">
                        How are we cooking this?
                      </p>
                      <p className="text-sm text-white/70 mt-1">{cookMethod}</p>
                    </div>
                  ) : (
                    <>
                      {/* Intro */}
                      <p className="text-sm text-white/80">
                        Tap <strong>Listen</strong> and we'll set the cooking
                        method.
                      </p>

                      {/* Listen Button */}
                      {!hasListenedStep2 && (
                        <button
                          className={`w-full py-3 rounded-xl border text-white font-medium transition ${
                            isPlaying
                              ? "bg-green-900/40 border-green-500/40"
                              : "bg-black/40 border-white/20 hover:bg-black/50"
                          }`}
                          onClick={handleListenCookMethod}
                          disabled={isPlaying}
                          data-testid="button-listen-cook-method"
                        >
                          {isPlaying ? "Speaking..." : "Listen to Chef"}
                        </button>
                      )}

                      {/* Options */}
                      {hasListenedStep2 && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {["Stovetop", "Oven", "Air Fryer", "Grill"].map(
                              (method) => (
                                <button
                                  key={method}
                                  onClick={() => setCookMethod(method)}
                                  className={`py-2 rounded-lg border text-sm transition ${
                                    cookMethod === method
                                      ? "bg-lime-600 text-black border-lime-600"
                                      : "bg-black/40 text-white border-white/20 hover:bg-black/50"
                                  }`}
                                >
                                  {method}
                                </button>
                              )
                            )}
                          </div>

                          <button
                            className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm disabled:opacity-50 transition"
                            disabled={!cookMethod || isPlaying}
                            onClick={handleSubmitCookMethod}
                            data-testid="button-submit-cook-method"
                          >
                            Continue
                          </button>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
