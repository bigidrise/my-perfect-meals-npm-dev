import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, CheckCircle2, User, GraduationCap, Loader2 } from "lucide-react";

interface CertStatus {
  phase1Complete: boolean;
  phase2Complete: boolean;
  loading: boolean;
}

export default function ProfessionalOnboardingBridge() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [certStatus, setCertStatus] = useState<CertStatus>({
    phase1Complete: false,
    phase2Complete: false,
    loading: true,
  });

  useEffect(() => {
    if (!user) return;

    if (!user.professionalRole) {
      setLocation("/dashboard");
      return;
    }

    // Admins bypass all certification gates — send straight to the pro portal
    if (user.isAdmin) {
      setLocation(user.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients");
      return;
    }

    (async () => {
      try {
        const [p1Res, p2Res] = await Promise.allSettled([
          apiRequest("/api/certifications/phase1-status"),
          apiRequest("/api/certifications/procare_training/progress"),
        ]);

        const phase1Complete =
          p1Res.status === "fulfilled" &&
          (p1Res.value as any)?.phase1Complete === true;

        const phase2Complete =
          p2Res.status === "fulfilled" &&
          (p2Res.value as any)?.certification?.status === "completed" &&
          !!(p2Res.value as any)?.certification?.completedAt;

        if (phase1Complete && phase2Complete) {
          const route =
            user.professionalRole === "physician"
              ? "/pro/physician-clients"
              : "/pro/clients";
          setLocation(route);
          return;
        }

        setCertStatus({ phase1Complete, phase2Complete, loading: false });
      } catch {
        setCertStatus({ phase1Complete: false, phase2Complete: false, loading: false });
      }
    })();
  }, [user]);

  if (certStatus.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  const personalDone = !!user?.onboardingCompletedAt;
  const phase1Done = certStatus.phase1Complete;

  if (!personalDone) {
    return <PersonalOnboardingStep onStart={() => setLocation("/onboarding")} />;
  }

  if (!phase1Done) {
    return <CertPhase1Step onStart={() => setLocation("/certifications/platform")} />;
  }

  return <CertPhase2Step onStart={() => setLocation("/procare-training")} />;
}

function PersonalOnboardingStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 px-4 pt-16 pb-32 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-orange-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
            <span className="text-xs font-semibold text-orange-300">Step 1 of 3</span>
          </div>
          <h1 className="text-2xl font-black leading-tight mb-3">
            Experience My Perfect Meals as a User
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Before guiding your clients, you'll complete your own personal My Perfect Meals profile.
            This ensures you understand exactly what your clients experience.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {[
            "Set up your personal nutrition profile",
            "Define your goals and dietary preferences",
            "Generate your first AI-powered meal plan",
            "Explore the meal builders and tools",
            "Experience the app as your clients will",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <p className="text-sm text-white/80">{item}</p>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
          <p className="text-xs text-white/50 italic text-center leading-relaxed">
            "You can't confidently guide someone through an experience you haven't had yourself."
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button
          onClick={onStart}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Set Up My Personal Profile
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function CertPhase1Step({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 px-4 pt-16 pb-32 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-orange-400" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Personal Profile Complete</span>
            </div>
          </div>
          <p className="text-orange-300 text-sm font-semibold mb-2">Excellent.</p>
          <h1 className="text-2xl font-black leading-tight mb-3">
            You've Experienced My Perfect Meals as a User
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            You now understand what your clients will experience. Next, you'll learn how to use every
            feature professionally so you can confidently guide them.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/30 border border-orange-500/20 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-full border border-orange-500/30">
              <span className="text-xs font-semibold text-orange-300">Step 2 of 3</span>
            </div>
          </div>
          <p className="text-sm font-bold text-white mb-2">Phase 1 — Platform Fundamentals</p>
          <p className="text-xs text-white/60 leading-relaxed mb-3">
            Learn how to use every feature of the platform — client onboarding, meal builders,
            AI personalization, nutrition protocols, and more.
          </p>
          <div className="space-y-2">
            {[
              "Every major feature of the platform",
              "How to personalize nutrition for each client",
              "How to use AI responsibly",
              "Client onboarding and setup",
              "Meal boards and progress tracking",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button
          onClick={onStart}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Begin Professional Certification
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function CertPhase2Step({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 px-4 pt-16 pb-32 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Personal Profile Complete</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Phase 1 Complete</span>
            </div>
          </div>
          <h1 className="text-2xl font-black leading-tight mb-3">
            Congratulations! You've Mastered the Platform.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Now let's learn how to build and grow your professional business using ProCare.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/30 border border-orange-500/20 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-full border border-orange-500/30">
              <span className="text-xs font-semibold text-orange-300">Step 3 of 3 — Final Step</span>
            </div>
          </div>
          <p className="text-sm font-bold text-white mb-2">Phase 2 — Business & ProCare Success</p>
          <p className="text-xs text-white/60 leading-relaxed mb-3">
            Learn how to manage clients, grow your practice, and get the most from every professional
            tool in the platform.
          </p>
          <div className="space-y-2">
            {[
              "Managing clients and care plans",
              "Professional questionnaires",
              "Studio and client communication",
              "Building recurring revenue",
              "Affiliate program and Business Suite",
              "Client retention and best practices",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button
          onClick={onStart}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Begin Phase 2 — Business & ProCare Success
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
