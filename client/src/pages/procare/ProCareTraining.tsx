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
import { useTranslation } from "react-i18next";
import { BC_GRADIENT } from "@/components/BusinessCenterShell";

interface TrainingSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  highlight?: string;
}


export default function ProCareTraining() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();
  const isDesktop = useIsDesktop();
  const { t } = useTranslation();

  const sections: TrainingSection[] = [
    {
      id: "overview",
      icon: <BookOpen className="w-6 h-6 text-orange-400" />,
      title: t("procare.training.sections.overview.title"),
      subtitle: t("procare.training.sections.overview.subtitle"),
      bullets: [
        t("procare.training.sections.overview.b1"),
        t("procare.training.sections.overview.b2"),
        t("procare.training.sections.overview.b3"),
        t("procare.training.sections.overview.b4"),
      ],
      highlight: t("procare.training.sections.overview.highlight"),
    },
    {
      id: "clients",
      icon: <Users className="w-6 h-6 text-orange-400" />,
      title: t("procare.training.sections.clients.title"),
      subtitle: t("procare.training.sections.clients.subtitle"),
      bullets: [
        t("procare.training.sections.clients.b1"),
        t("procare.training.sections.clients.b2"),
        t("procare.training.sections.clients.b3"),
        t("procare.training.sections.clients.b4"),
        t("procare.training.sections.clients.b5"),
      ],
      highlight: t("procare.training.sections.clients.highlight"),
    },
    {
      id: "safety",
      icon: <ShieldCheck className="w-6 h-6 text-orange-400" />,
      title: t("procare.training.sections.safety.title"),
      subtitle: t("procare.training.sections.safety.subtitle"),
      bullets: [
        t("procare.training.sections.safety.b1"),
        t("procare.training.sections.safety.b2"),
        t("procare.training.sections.safety.b3"),
        t("procare.training.sections.safety.b4"),
        t("procare.training.sections.safety.b5"),
      ],
      highlight: t("procare.training.sections.safety.highlight"),
    },
    {
      id: "standards",
      icon: <Star className="w-6 h-6 text-orange-400" />,
      title: t("procare.training.sections.standards.title"),
      subtitle: t("procare.training.sections.standards.subtitle"),
      bullets: [
        t("procare.training.sections.standards.b1"),
        t("procare.training.sections.standards.b2"),
        t("procare.training.sections.standards.b3"),
        t("procare.training.sections.standards.b4"),
        t("procare.training.sections.standards.b5"),
      ],
      highlight: t("procare.training.sections.standards.highlight"),
    },
    {
      id: "complete",
      icon: <CheckCircle2 className="w-6 h-6 text-orange-400" />,
      title: t("procare.training.sections.complete.title"),
      subtitle: t("procare.training.sections.complete.subtitle"),
      bullets: [
        t("procare.training.sections.complete.b1"),
        t("procare.training.sections.complete.b2"),
        t("procare.training.sections.complete.b3"),
      ],
      highlight: t("procare.training.sections.complete.highlight"),
    },
  ];

  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = sections[step];
  const isFirst = step === 0;
  const isLast = step === sections.length - 1;
  const progress = ((step) / (sections.length - 1)) * 100;

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
          {t("procare.training.completeUnlock")}
          <CheckCircle2 className="w-5 h-5" />
        </>
      )}
    </button>
  ) : (
    <button
      onClick={handleNext}
      className="w-full h-14 text-md font-semibold rounded-2xl bg-orange-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
    >
      {t("procare.training.continueButton")}
      <ArrowRight className="w-5 h-5" />
    </button>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} text-white ${isDesktop ? "pb-8" : "flex flex-col"}`}>
      <div className={`px-4 max-w-lg mx-auto w-full ${isDesktop ? "pt-6 pb-0" : "flex-1 pt-10 pb-32"}`}>

        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-white/60 text-sm mb-6 active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          {isFirst ? t("procare.training.backToLaunchpad") : t("procare.training.back")}
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-300">{t("procare.training.phase2Label")}</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{current.title}</h1>
          <p className="text-white/50 text-sm">{current.subtitle}</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">{t("procare.training.progress")}</span>
            <span className="text-[10px] text-white/40">
              {t("procare.training.stepOf", { current: step + 1, total: sections.length })}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / sections.length) * 100}%` }}
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
          {sections.map((s, i) => (
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
