import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Heart,
  Utensils,
  Shield,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { voiceManager } from "@/voice/VoiceManager";

const SECTIONS = [
  {
    id: "smart",
    icon: <Sparkles className="w-6 h-6 text-orange-400" />,
    title: "Meals Built Around You",
    points: [
      "Every meal is tailored to your goals, preferences, and lifestyle",
      "AI-powered suggestions that actually taste good",
      "No cookie-cutter plans — this is personalized nutrition",
    ],
  },
  {
    id: "easy",
    icon: <Utensils className="w-6 h-6 text-lime-400" />,
    title: "Simple, Not Stressful",
    points: [
      "No counting, no guessing, no guilt",
      "Built-in guardrails keep you on track automatically",
      "Enjoy your favorites while staying aligned with your goals",
    ],
  },
  {
    id: "safe",
    icon: <Shield className="w-6 h-6 text-emerald-400" />,
    title: "Science-Backed & Safe",
    points: [
      "Built on NIH guidelines and accepted nutritional standards",
      "Allergy and dietary safety built in from day one",
      "Transparent nutrition data — no hidden surprises",
    ],
  },
  {
    id: "enjoy",
    icon: <Heart className="w-6 h-6 text-pink-400" />,
    title: "Food You Actually Enjoy",
    points: [
      "Craving something? We've got a studio for that",
      "Desserts, comfort food, dining out — all accounted for",
      "No food guilt. Foods don't cause weight gain — context does",
    ],
  },
];

const COPILOT_SCRIPT = `Hey, welcome to My Perfect Meals.

I'm Chef — and I'm here to help you build meals you actually enjoy, while staying on track with your goals.

Here's how this works. You tell me about yourself — your goals, your preferences, any dietary needs — and I build meals around you. Not the other way around.

No food guilt. No guesswork. No cookie-cutter plans. Just real meals, built for your real life.

The app uses science-backed nutrition guidelines to keep things safe and smart. But you're always in control. You decide what you eat. I just make sure the numbers work.

Whether you're cooking at home, dining out, craving something sweet, or just don't know what to make — I've got you covered.

When you're ready, tap Continue to create your account. Let's get you set up.`;

export default function ConsumerWelcome() {
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>("smart");
  const [isPlaying, setIsPlaying] = useState(false);
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

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Back button */}
        <div className="pt-6 pb-2">
          <button
            onClick={() => setLocation("/welcome")}
            className="flex items-center gap-1 text-white/60 text-sm mb-2 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Chef Hero Section */}
        <div className="flex flex-col items-center mb-4 -mt-2">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-[26rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0">Welcome to My Perfect Meals</h1>
          <p className="text-white/60 text-sm leading-relaxed text-center mt-1 max-w-xs">
            Meals built around your goals, your preferences, and your life.
          </p>
        </div>

        {/* Copilot Audio Button */}
        <div className="mb-6">
          <button
            onClick={toggleCopilot}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-900/50 to-amber-900/50 border border-orange-400/20 active:scale-[0.98] transition-transform"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? "bg-red-500/20 border border-red-400/30" : "bg-orange-500/20 border border-orange-400/30"}`}>
              {isPlaying ? <Pause className="w-5 h-5 text-red-400" /> : <Play className="w-5 h-5 text-orange-400 ml-0.5" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-white">
                {isPlaying ? "Listening to Chef..." : "Meet Chef — Hear What We're About"}
              </p>
              <p className="text-xs text-white/50">
                {isPlaying ? "Tap to stop" : "A quick intro from our Copilot"}
              </p>
            </div>
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            return (
              <div
                key={section.id}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:scale-[0.98] transition-transform"
                >
                  {section.icon}
                  <span className="text-sm font-semibold flex-1 text-left">{section.title}</span>
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {section.points.map((point, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-1.5 shrink-0" />
                        <p className="text-sm text-white/70">{point}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Philosophy Statement */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-400/10">
          <p className="text-sm text-white/60 italic text-center">
            "No food guilt. No guesswork. Just real meals, built for your real life."
          </p>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/auth")}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Skip / Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
