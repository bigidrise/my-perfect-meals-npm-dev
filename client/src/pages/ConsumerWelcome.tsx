import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { voiceManager } from "@/voice/VoiceManager";

const COPILOT_SCRIPT = `Hey, welcome to My Perfect Meals.

I'm Chef — and I'm here to help you build meals you actually enjoy, while staying on track with your goals.

Here's how this works. You tell me about yourself — your goals, your preferences, any dietary needs — and I build meals around you. Not the other way around.

No food guilt. No guesswork. No cookie-cutter plans. Just real meals, built for your real life.

The app uses science-backed nutrition guidelines to keep things safe and smart. But you're always in control. You decide what you eat. I just make sure the numbers work.

Whether you're cooking at home, dining out, craving something sweet, or just don't know what to make — I've got you covered.

When you're ready, tap Continue to create your account. Let's get you set up.`;

export default function ConsumerWelcome() {
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasReadExplanation, setHasReadExplanation] = useState(false);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const voiceRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (voiceRef.current) {
        voiceManager.stop();
        voiceRef.current = false;
      }
    };
  }, []);

  const toggleCopilot = async () => {
    if (isPlaying) {
      voiceManager.stop();
      voiceRef.current = false;
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      voiceRef.current = true;
      await voiceManager.preload();
      const result = await voiceManager.speak(COPILOT_SCRIPT, () => {
        setIsPlaying(false);
        voiceRef.current = false;
      });
      if (result.status !== "playing") {
        setIsPlaying(false);
        voiceRef.current = false;
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="pt-10 pb-2">
          <button
            onClick={() => setLocation("/welcome")}
            className="flex items-center gap-1 text-white/60 text-sm mb-2 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="flex flex-col items-center mb-4 -mt-2">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-[26rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0">
            Welcome to My Perfect Meals
          </h1>
          <p className="text-white/60 text-sm leading-relaxed text-center mt-1 max-w-xs">
            Meals built around your goals, your preferences, and your life.
          </p>
        </div>

        <div className="mb-6">
          <button
            onClick={toggleCopilot}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-900/50 to-amber-900/50 border border-orange-400/20 active:scale-[0.98] transition-transform ${!isPlaying ? "animate-pulse-glow-orange" : ""}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? "bg-red-500/20 border border-red-400/30" : "bg-orange-500/20 border border-orange-400/30"}`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-red-400" />
              ) : (
                <Play className="w-5 h-5 text-orange-400 ml-0.5" />
              )}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-white">
                {isPlaying
                  ? "Listening to Chef..."
                  : "Meet Chef — Hear What We're About"}
              </p>
              <p className="text-xs text-white/50">
                {isPlaying ? "Tap to stop" : "A quick intro from our Copilot"}
              </p>
            </div>
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-lg font-bold text-white mb-3">How My Perfect Meals Works</h2>
          <div className="space-y-3 text-sm text-white/70 leading-relaxed">
            <p>
              My Perfect Meals works like a real nutrition coach.
            </p>
            <p>
              During setup you will answer a few questions about your goals, how you normally eat,
              your lifestyle, and any health considerations that may affect your food choices. This
              information allows the system to calculate your personal nutrition targets and guide
              your daily food decisions.
            </p>
            <p>
              For people managing real health concerns such as diabetes, inflammation, digestive
              sensitivities, or other dietary restrictions, the system includes built-in guardrails
              designed to help filter and guide food choices more responsibly.
            </p>
            <p>
              Instead of simply logging food after you eat it, My Perfect Meals helps guide what
              to eat <span className="font-semibold text-white">before</span> you eat it.
            </p>
            <p>
              Think of it as a <span className="font-semibold text-white">nutrition coach in your
              pocket</span> helping you make smarter food decisions wherever you eat.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <Checkbox
            id="read-explanation"
            checked={hasReadExplanation}
            onCheckedChange={(checked) => setHasReadExplanation(checked as boolean)}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
          />
          <label htmlFor="read-explanation" className="text-sm text-white/80 leading-tight cursor-pointer">
            I have read and understand how My Perfect Meals works
          </label>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-5 mb-4">
          <h2 className="text-lg font-bold text-red-400 mb-3">MEDICAL DISCLAIMER</h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            My Perfect Meals is not a medical service. The information you provide during
            onboarding is used to generate personalized meal suggestions based on your
            preferences, goals, and health inputs. This app does not diagnose, treat, or cure
            any medical conditions. It is not a substitute for professional medical advice,
            diagnosis, or treatment. Always consult your physician or a qualified healthcare
            provider before making changes to your diet, medications, or lifestyle.
          </p>

          <div className="space-y-3">
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">CONSULT YOUR HEALTHCARE PROVIDER</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>Before starting any new diet or nutrition plan</li>
                <li>If you have any medical conditions or take medications</li>
                <li>If you are pregnant, breastfeeding, or have special dietary needs</li>
                <li>If you have food allergies or intolerances</li>
              </ul>
            </div>

            <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">AI-GENERATED CONTENT</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>Meal suggestions are generated by artificial intelligence</li>
                <li>Content may contain errors or be inappropriate for your specific needs</li>
                <li>Always verify nutritional information independently</li>
                <li>Use your own judgment when following meal recommendations</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-white/80 mb-2">YOUR RESPONSIBILITY</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>You are responsible for your own health and safety</li>
                <li>This app does not provide medical advice or treatment</li>
                <li>Never ignore professional medical advice because of information from this app</li>
                <li>Seek immediate medical attention for any health emergencies</li>
              </ul>
            </div>

            <div className="bg-red-950/40 border border-red-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-400 mb-2">LIMITATIONS</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>This app is not approved by the FDA</li>
                <li>Not intended to diagnose, treat, cure, or prevent any disease</li>
                <li>Individual results may vary</li>
                <li>No guarantee of accuracy of nutritional information</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-6">
          <Checkbox
            id="accept-disclaimer"
            checked={hasAcceptedDisclaimer}
            onCheckedChange={(checked) => setHasAcceptedDisclaimer(checked as boolean)}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
          />
          <label htmlFor="accept-disclaimer" className="text-sm text-white/80 leading-tight cursor-pointer">
            I accept the medical disclaimer and understand this app does not replace professional medical advice
          </label>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/onboarding")}
          disabled={!hasReadExplanation || !hasAcceptedDisclaimer}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Onboarding
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
