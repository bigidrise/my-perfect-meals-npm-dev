import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, GraduationCap, User, Rocket, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NarrationBar } from "@/components/NarrationBar";

const COPILOT_SECTIONS = [
  {
    heading: "Welcome — here's what's about to happen",
    text: "Welcome to My Perfect Meals Professional. I'm Chef Copilot, and before you dive in, I want you to understand exactly what's about to happen — and why it's designed this way. Every My Perfect Meals professional completes a three-step onboarding before accessing the Studio. Not because it's a requirement. Because it works.",
  },
  {
    heading: "Your three steps",
    text: "Step one: you'll complete your own My Perfect Meals profile, generate your own nutrition plan, and experience the app exactly the way your future clients will. Step two: you'll complete Professional Certification — Platform Fundamentals — where you'll learn every feature of the platform, how to personalize nutrition, and how to onboard clients efficiently. Step three: Business and ProCare Success, where you'll learn to build your practice, manage clients, use the Studio, and grow recurring revenue. When you're finished, your Professional Studio and Business Suite will unlock — and you'll enter them prepared, not guessing. Professionals who complete this onboarding are more confident, provide better client outcomes, and grow their businesses faster. That's not marketing. That's what we've seen.",
  },
];

const JOURNEY_STEPS = [
  {
    number: "1",
    icon: <User className="w-5 h-5 text-orange-400" />,
    title: "Experience My Perfect Meals as a User",
    description:
      "Complete your own personal profile and generate your first nutrition plan. You'll understand exactly what your clients experience before you ever guide one.",
  },
  {
    number: "2",
    icon: <GraduationCap className="w-5 h-5 text-orange-400" />,
    title: "Professional Certification — Phase 1: Platform Fundamentals",
    description:
      "Master every feature of the platform. Learn to personalize nutrition, use AI responsibly, onboard clients, and save time through automation.",
  },
  {
    number: "3",
    icon: <Rocket className="w-5 h-5 text-orange-400" />,
    title: "Professional Certification — Phase 2: Business & ProCare Success",
    description:
      "Learn to manage clients, use the Studio, build recurring revenue, run questionnaires, and grow your professional practice using ProCare.",
  },
];

const CERT_BENEFITS = [
  "Learn every feature of the platform",
  "Learn how to personalize nutrition for each client",
  "Learn how to use AI responsibly and effectively",
  "Learn how to onboard clients efficiently",
  "Learn how to save time through automation",
  "Learn how to build and grow recurring revenue",
  "Learn how to use the Studio and Business Suite",
  "Learn how to confidently answer client questions",
];

export default function ProCareWelcome() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isTrainerWelcome = location === "/trainer-welcome";
  const isPhysicianWelcome = location === "/physician-welcome";
  const role: "trainer" | "physician" | null = isTrainerWelcome
    ? "trainer"
    : isPhysicianWelcome
      ? "physician"
      : null;

  const handleBegin = () => {
    if (role === "trainer" || role === "physician") {
      setLocation("/professional-onboarding-bridge");
    } else {
      setLocation("/procare-identity");
    }
  };

  const roleLabel =
    role === "trainer"
      ? "Trainer"
      : role === "physician"
        ? "Physician"
        : "Professional";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-36">
        <div className="pt-10 pb-2" />

        {/* In-content back button — visible on both mobile and desktop */}
        <button
          onClick={() => setLocation("/business-center")}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Business Suite
        </button>

        {/* Hero */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-56 h-auto"
          />
          <h1 className="text-3xl font-black mt-3 leading-tight">
            Welcome to My Perfect Meals Professional
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mt-2 max-w-xs">
            {role
              ? `Your ${roleLabel} account is ready.`
              : "Your professional account is ready."}{" "}
            Before you begin working with clients, every professional completes a three-step onboarding process.
          </p>
        </div>

        {/* Copilot */}
        <div className="mb-6 px-4 py-3 rounded-xl bg-black/30 border border-orange-500/30">
          <p className="text-xs text-white/50 mb-2">
            Hear the full journey explained by Chef Copilot
          </p>
          <NarrationBar sections={COPILOT_SECTIONS} speedOverride="1.0" />
        </div>

        {/* 3-Step Journey */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400 mb-3">
            Your Professional Journey
          </p>
          <div className="space-y-3">
            {JOURNEY_STEPS.map((step) => (
              <div
                key={step.number}
                className="flex items-start gap-4 p-4 rounded-2xl bg-black/30 border border-white/10"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-black text-orange-400">{step.number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug mb-1">{step.title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why it matters */}
        <div className="mb-6 p-4 rounded-2xl bg-black/30 border border-orange-500/20">
          <p className="text-sm font-bold text-white mb-3">Why every professional begins with certification</p>
          <div className="space-y-2">
            {CERT_BENEFITS.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-white/70 leading-relaxed">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
          <p className="text-sm text-white/60 italic text-center leading-relaxed">
            "Every My Perfect Meals professional completes this certification before entering the Studio.
            Professionals who go through it are more confident, provide better client outcomes,
            and grow their businesses faster."
          </p>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        {user?.onboardingCompletedAt ? (
          <div className="mb-2 text-center">
            <p className="text-xs text-white/40">Personal profile already complete — continuing to certification</p>
          </div>
        ) : null}
        <button
          onClick={handleBegin}
          className="w-full h-14 text-md font-bold rounded-2xl bg-orange-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Begin Your Professional Journey
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
