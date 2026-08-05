import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Users,
  ShieldCheck,
  Star,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { PillButton } from "@/components/ui/pill-button";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface TrainingSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  highlight?: string;
}

const SECTIONS: TrainingSection[] = [
  {
    id: "overview",
    icon: <BookOpen className="w-6 h-6 text-orange-400" />,
    title: "Welcome to ProCare",
    subtitle: "Your role on the platform",
    bullets: [
      "ProCare gives you a dedicated workspace to manage clients, build personalized meal plans, and monitor progress — all within My Perfect Meals.",
      "As a ProCare professional, you operate within a structured hierarchy: medical requirements always take precedence, followed by dietary identity, cultural preference, and behavioral preference.",
      "You are responsible for the guidance you provide. The platform amplifies your expertise — it does not replace your professional judgment.",
      "Your clients will see meal plans, dietary tracking, and AI-generated dishes tailored to the protocols you set. Your job is to set those protocols accurately and update them as the client's needs evolve.",
    ],
    highlight: "ProCare is a tool that extends your practice — not a substitute for your clinical training.",
  },
  {
    id: "clients",
    icon: <Users className="w-6 h-6 text-orange-400" />,
    title: "Client Management",
    subtitle: "Onboarding and ongoing care",
    bullets: [
      "Clients are added to your roster from the Studio. You can invite them by email, assign meal builders, and configure their dietary profile from your ProCare dashboard.",
      "Each client has an individual protocol card where you set their calorie and macro targets, dietary restrictions, clinical mode (if applicable), and cuisine preferences.",
      "Meal boards let you pre-build or approve meals for your clients. Clients can view and log approved meals directly in their app.",
      "Use the messaging feature to communicate with clients inside the platform. Tablet notes give you a private space to document client progress and observations.",
      "Client data — including biometrics, meal logs, and progress notes — is only visible to you and the client. It is never shared with other professionals or third parties.",
    ],
    highlight: "Keep client profiles current. Stale protocols lead to misaligned AI-generated meals.",
  },
  {
    id: "safety",
    icon: <ShieldCheck className="w-6 h-6 text-orange-400" />,
    title: "Safety & Protocol Guardrails",
    subtitle: "How the platform protects your clients",
    bullets: [
      "The 4-Layer Constraint Hierarchy governs all AI meal generation: (1) Medical requirements are absolute and cannot be overridden. (2) Dietary identity (e.g., vegan, halal) is enforced. (3) Cultural and cuisine preferences shape output. (4) Behavioral preferences like heat level are applied last.",
      "Macro values are never invented by the AI. If a macro is unknown, it is left as null — not estimated or filled in. You may set macro targets explicitly; the system will never silently change them.",
      "Clinically sensitive modes — such as Oncology Support and Anti-Inflammatory protocols — enforce hard ingredient restrictions at the generation level. These cannot be disabled by the client.",
      "Heat, spice, and texture preferences can be overridden by clinical safety rules when a client's medical condition makes certain inputs unsafe.",
      "If you assign a clinical protocol, ensure you have the professional basis to do so. Physician-level protocols require physician-role access.",
    ],
    highlight: "When in doubt, err on the side of the more restrictive setting. Clients can always request more flexibility in a follow-up session.",
  },
  {
    id: "standards",
    icon: <Star className="w-6 h-6 text-orange-400" />,
    title: "Professional Standards",
    subtitle: "Ethics, accountability, and best practices",
    bullets: [
      "You attested at sign-up to the accuracy of your professional credentials. Misrepresentation of credentials is grounds for immediate removal from the platform.",
      "Never use ProCare to diagnose, treat, or cure a medical condition. Nutritional guidance is supportive, not curative. Direct clients to licensed medical professionals for clinical concerns.",
      "Maintain accurate, up-to-date client profiles. Document changes when a client's medical situation, goals, or dietary identity shifts.",
      "Respect client autonomy. ProCare allows you to recommend and restrict, but clients retain the right to make their own dietary decisions outside of clinically enforced guardrails.",
      "If you suspect a client is in a medical crisis, instruct them to contact emergency services immediately. The platform is not a crisis intervention tool.",
    ],
    highlight: "Your professional reputation is the most important asset in your ProCare practice. The platform reflects you.",
  },
  {
    id: "complete",
    icon: <CheckCircle2 className="w-6 h-6 text-orange-400" />,
    title: "You're Ready",
    subtitle: "Final acknowledgment",
    bullets: [
      "You've reviewed the core ProCare operating principles, client management workflow, safety guardrails, and professional standards.",
      "By completing this training, you acknowledge that you understand your responsibilities as a ProCare professional and will use the platform in accordance with these principles.",
      "Your Studio will unlock immediately after you complete this training. You can begin adding clients, building meal plans, and configuring client protocols right away.",
    ],
    highlight: "Welcome to ProCare. Your clients are counting on you.",
  },
];

export default function ProCareTraining() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();
  const isDesktop = useIsDesktop();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = SECTIONS[step];
  const isFirst = step === 0;
  const isLast = step === SECTIONS.length - 1;
  const progress = ((step) / (SECTIONS.length - 1)) * 100;

  const handleNext = () => {
    if (!isLast) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setLocation("/professional-onboarding-bridge");
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      await apiRequest("/api/pro/training/complete", { method: "POST" });
      await refreshUser();
      setLocation("/procare-certified");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setCompleting(false);
    }
  };

  const ctaButton = isLast ? (
    <button
      onClick={handleComplete}
      disabled={completing}
      className="w-full h-14 text-md font-semibold rounded-2xl bg-orange-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
    >
      {completing ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Completing Training...
        </>
      ) : (
        <>
          Complete Training & Unlock Studio
          <CheckCircle2 className="w-5 h-5" />
        </>
      )}
    </button>
  ) : (
    <button
      onClick={handleNext}
      className="w-full h-14 text-md font-semibold rounded-2xl bg-orange-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
    >
      Continue
      <ArrowRight className="w-5 h-5" />
    </button>
  );

  return (
    <div className={`bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white ${isDesktop ? "pb-8" : "min-h-screen flex flex-col"}`}>
      <div className={`px-4 max-w-lg mx-auto w-full ${isDesktop ? "pt-6 pb-0" : "flex-1 pt-10 pb-32"}`}>

        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-white/60 text-sm mb-6 active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          {isFirst ? "Back to Launchpad" : "Back"}
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-300">ProCare Training — Phase 2</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{current.title}</h1>
          <p className="text-white/50 text-sm">{current.subtitle}</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">Progress</span>
            <span className="text-[10px] text-white/40">
              {step + 1} of {SECTIONS.length}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            {current.icon}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {current.bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <ChevronRight className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm text-white/80 leading-relaxed">{bullet}</p>
            </div>
          ))}
        </div>

        {current.highlight && (
          <div className="mb-6 p-4 rounded-xl bg-orange-900/20 border border-orange-400/20">
            <p className="text-sm text-orange-300 font-medium leading-relaxed">
              💡 {current.highlight}
            </p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap justify-center mb-2">
          {SECTIONS.map((s, i) => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < step
                  ? "bg-orange-400"
                  : i === step
                    ? "bg-white"
                    : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-400/30 bg-red-900/20">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* CTA inline on desktop */}
        {isDesktop && (
          <div className="mt-6">
            {ctaButton}
          </div>
        )}
      </div>

      {/* CTA fixed on mobile */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-lg mx-auto">
            {ctaButton}
          </div>
        </div>
      )}
    </div>
  );
}
