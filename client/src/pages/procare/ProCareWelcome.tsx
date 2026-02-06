import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Shield,
  Target,
  Users,
  Sliders,
  User,
  ChevronDown,
  HandCoins,
} from "lucide-react";
import { voiceManager } from "@/voice/VoiceManager";

const SECTIONS = [
  {
    id: "respect",
    icon: <Target className="w-6 h-6 text-blue-400" />,
    title: "You Set the Plan",
    points: [
      "You define the strategy and direction",
      "You decide what's right for each client",
      "The app never overrides your professional judgment",
      "Your expertise drives every decision",
    ],
  },
  {
    id: "baseline",
    icon: <Shield className="w-6 h-6 text-emerald-400" />,
    title: "A Safe, Evidence-Based Baseline",
    points: [
      "Built from NIH guidelines and accepted clinical standards",
      "Designed to be safe and conservative by default",
      "Saves you time — no starting from zero",
      "You can keep it as-is, adjust within guardrails, or override it entirely",
    ],
  },
  {
    id: "guardrails",
    icon: <Sliders className="w-6 h-6 text-amber-400" />,
    title: "Guardrails Are Defaults, Not Restrictions",
    points: [
      "Guardrails prevent client drift between sessions",
      "They can be overridden intentionally at any time",
      "All overrides are visible and controlled by you",
      "Think of them as assistants, not barriers",
    ],
  },
  {
    id: "compliance",
    icon: <Users className="w-6 h-6 text-purple-400" />,
    title: "Your Compliance Partner",
    points: [
      "Keeps clients aligned when you're not present",
      "Maintains structure when decision fatigue is highest",
      "Reduces off-plan behavior during weekends, social events, and travel",
      "The coach sets the track — the app keeps the client on it",
    ],
  },
  {
    id: "personal",
    icon: <User className="w-6 h-6 text-cyan-400" />,
    title: "Full Personal Access Included",
    points: [
      "Use all meal builders for your own nutrition",
      "Experience exactly what your clients experience",
      "One account — professional tools and personal use",
      "See the app through your client's eyes",
    ],
  },
  {
    id: "affiliate",
    icon: <HandCoins className="w-6 h-6 text-green-400" />,
    title: "Professional Affiliate Program",
    points: [
      "Sign up and receive your own unique product code",
      "Share your code with clients, followers, and your community",
      "Earn 25% of every subscription that signs up using your code",
      "Commissions paid directly to your bank account — no caps, no limits",
    ],
  },
];

const COPILOT_SCRIPT = `Welcome to My Perfect Meals for Professionals.

Before you create your account, we want you to clearly understand what this platform is, how it works, and most importantly — how it respects your role.

You set the plan. You define the strategy. You decide what's right for each client. My Perfect Meals will never override your professional judgment. Your expertise drives every decision.

The app includes a safe, evidence-based baseline — built from NIH guidelines and accepted clinical standards. It's designed to be conservative and save you time, so you never have to start from zero. But you're always in control. You can keep the baseline as-is, adjust within guardrails, or override it entirely.

Speaking of guardrails — think of them as defaults, not restrictions. They prevent client drift between sessions. They can be overridden intentionally at any time, and all overrides are visible and controlled by you.

Here's where the real value lives. When you're not present — when social pressure is high, when structure tends to break down — My Perfect Meals keeps your plan intact. You set the track. The app keeps the client on it.

Your professional account also includes full personal access. Use all the meal builders for your own nutrition. Experience exactly what your clients experience. One account — professional tools and personal use.

And here's something you'll want to know about: the Professional Affiliate Program. When you sign up, you'll receive your own unique product code. Share that code with your clients, your followers, your community — anyone who could benefit from the app. For every subscription that signs up using your code, you earn twenty-five percent — paid directly to your bank account. No caps, no limits. The more people you help, the more you earn.

When you're ready, tap Continue to tell us about your professional background.`;

export default function ProCareWelcome() {
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>("respect");
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
          <h1 className="text-2xl font-bold italic mt-0">Welcome, Professional</h1>
          <p className="text-white/60 text-sm leading-relaxed text-center mt-1 max-w-xs">
            Before you create an account, understand how My Perfect Meals works <span className="italic">with</span> you, not instead of you.
          </p>
          <p className="text-green-400/80 text-xs mt-2 font-medium">
            Ask about our affiliate program for 25% commission.
          </p>
        </div>

        {/* Copilot Audio Button */}
        <div className="mb-6">
          <button
            onClick={toggleCopilot}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-400/20 active:scale-[0.98] transition-transform"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? "bg-red-500/20 border border-red-400/30" : "bg-blue-500/20 border border-blue-400/30"}`}>
              {isPlaying ? <Pause className="w-5 h-5 text-red-400" /> : <Play className="w-5 h-5 text-blue-400 ml-0.5" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-white">
                {isPlaying ? "Listening to Professional Overview..." : "Listen to Professional Overview"}
              </p>
              <p className="text-xs text-white/50">
                {isPlaying ? "Tap to stop" : "Hear everything explained by our Copilot"}
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
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-400/10">
          <p className="text-sm text-white/60 italic text-center">
            "My Perfect Meals is not a coaching system. It is a compliance system that works for the coach."
          </p>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/procare-identity")}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
