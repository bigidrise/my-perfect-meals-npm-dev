import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Users,
  ChefHat,
  GraduationCap,
  Handshake,
  Tag,
  ChevronRight,
  Trophy,
  CheckCircle2,
  Circle,
  Loader2,

  Salad,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { getTierForLookupKey } from "@shared/planFeatures";

interface CertProgress {
  personalDone: boolean;
  phase1Done: boolean;
  phase2Done: boolean;
  loading: boolean;
}

// Add new professional certifications here — no UI redesign required.
// Each entry maps to a CertProgress key for the "done" state.
// i18n: leave for content team
const PROFESSIONAL_CERTS: {
  label: string;
  sublabel: string;
  doneKey: keyof Omit<CertProgress, "loading">;
  route: string;
}[] = [
  {
    label: "Personal Experience",
    sublabel: "Completed personal onboarding",
    doneKey: "personalDone",
    route: "/onboarding",
  },
  {
    label: "Phase 1 — Platform Fundamentals",
    sublabel: "Platform mastery certification",
    doneKey: "phase1Done",
    route: "/certifications/platform",
  },
  {
    label: "Phase 2 — Business & ProCare Success",
    sublabel: "Business & practice training",
    doneKey: "phase2Done",
    route: "/procare-training",
  },
];

export default function BusinessCenter() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation("businessCenter");
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  // Business-only accounts are NOT ProCare practitioners — exclude from cert card
  const isProfessional = !!(
    (user?.professionalRole && user?.professionalRole !== "business") ||
    user?.isProCare
  );
  const isBusinessAccount = user?.professionalRole === "business";

  const tier = getTierForLookupKey(user?.planLookupKey);
  const isPro = tier === "premium" || tier === "ultimate";
  const isInternal = user?.accessTier === "PAID_FULL" && !user?.planLookupKey;
  const hasProAccess = isPro || isInternal;

  const [certProgress, setCertProgress] = useState<CertProgress>({
    personalDone: false,
    phase1Done: false,
    phase2Done: false,
    loading: true,
  });

  useEffect(() => {
    document.title = "Business Center | My Perfect Meals";
    return () => { document.title = "My Perfect Meals"; };
  }, []);

  useEffect(() => {
    if (!isProfessional) {
      setCertProgress((p) => ({ ...p, loading: false }));
      return;
    }
    (async () => {
      try {
        const [p1Res, p2Res] = await Promise.allSettled([
          apiRequest("/api/certifications/phase1-status"),
          apiRequest("/api/certifications/procare_training/progress"),
        ]);
        const phase1Done =
          p1Res.status === "fulfilled" &&
          (p1Res.value as any)?.phase1Complete === true;
        const phase2Done =
          p2Res.status === "fulfilled" &&
          (p2Res.value as any)?.certification?.status === "completed";
        setCertProgress({
          personalDone: !!user?.onboardingCompletedAt,
          phase1Done,
          phase2Done,
          loading: false,
        });
      } catch {
        setCertProgress((p) => ({ ...p, loading: false }));
      }
    })();
  }, [isProfessional, user?.onboardingCompletedAt]);

  const allCertified =
    certProgress.personalDone && certProgress.phase1Done && certProgress.phase2Done;

  const pillars = [
    {
      id: "partners",
      title: t("businessCenter.pillars.partners"),
      description: t("businessCenter.pillars.partnersDesc"),
      icon: Handshake,
      route: "/business-center/partners",
      accent: "bg-orange-500/20",
      iconColor: "text-orange-400",
      border: "border-orange-500/20",
    },
    {
      id: "procare",
      title: t("businessCenter.pillars.procare"),
      description: t("businessCenter.pillars.procareDesc"),
      icon: Users,
      route: "/procare-welcome",
      accent: "bg-blue-500/20",
      iconColor: "text-blue-400",
      border: "border-blue-500/20",
    },
    {
      id: "academy",
      title: t("businessCenter.pillars.academy"),
      description: t("businessCenter.pillars.academyDesc"),
      icon: GraduationCap,
      route: "/business-center/academy",
      accent: "bg-orange-500/20",
      iconColor: "text-orange-400",
      border: "border-orange-500/20",
    },
    {
      id: "promotions",
      title: t("businessCenter.pillars.promotions"),
      description: t("businessCenter.pillars.promotionsDesc"),
      icon: Tag,
      route: "/business-center/promotions",
      accent: "bg-amber-500/20",
      iconColor: "text-amber-400",
      border: "border-amber-500/20",
    },
    {
      id: "creator-brand",
      title: t("businessCenter.pillars.creatorBrand"),
      description: t("businessCenter.pillars.creatorBrandDesc"),
      icon: ChefHat,
      route: "/creator-studio",
      accent: "bg-orange-500/20",
      iconColor: "text-orange-400",
      border: "border-orange-500/20",
    },
  ];

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/more")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("businessCenter.back")}
            </button>
            <h1 className="text-lg font-bold text-white">{t("businessCenter.title")}</h1>
            {!hasProAccess && (
              <span className="ml-auto px-2.5 py-0.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-[10px] font-semibold tracking-wide uppercase">
                Pro+
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className="px-4 max-w-2xl mx-auto space-y-3"
        style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="py-3 text-center">
          <p className="text-white/55 text-sm leading-relaxed">
            {t("businessCenter.tagline")}
          </p>
        </div>

        {/* Personal nutrition nudge — shown once for business accounts that haven't set up nutrition yet */}
        {isBusinessAccount && !user?.onboardingCompletedAt && (
          <motion.div
            className="w-full text-left p-5 rounded-2xl bg-black/40 border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 flex-shrink-0">
                <Salad className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white leading-snug mb-1">
                  {t("businessCenter.completeProfile")}
                </h3>
                <p className="text-xs text-white/55 mb-3 leading-relaxed">
                  {t("businessCenter.completeProfileDesc")}
                </p>
                <button
                  onClick={() => setLocation("/onboarding")}
                  className="text-xs font-semibold text-emerald-400 active:opacity-60 transition-opacity"
                >
                  {t("businessCenter.completeProfileBtn")}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Professional Certifications card — only for ProCare practitioners */}
        {isProfessional && (
          <motion.div
            className="w-full text-left p-5 rounded-2xl bg-black/50 border border-orange-500/30"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0">
                <Trophy className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {t("businessCenter.certifications")}
                  </h3>
                  {allCertified && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">
                      {t("businessCenter.certified")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/55 mb-3 leading-relaxed">
                  {t("businessCenter.certDesc")}
                </p>

                {certProgress.loading ? (
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {PROFESSIONAL_CERTS.map((cert) => (
                      <CertRow
                        key={cert.doneKey}
                        label={cert.label}
                        sublabel={cert.sublabel}
                        done={certProgress[cert.doneKey]}
                        onClick={() => setLocation(cert.route)}
                      />
                    ))}
                    {allCertified && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-sm">🏆</span>
                        <p className="text-xs font-semibold text-orange-300">
                          {t("businessCenter.certifiedBadge")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setLocation(allCertified ? "/certifications/platform" : "/professional-onboarding-bridge")}
                  className="text-xs font-semibold text-orange-400 active:opacity-60 transition-opacity"
                >
                  {allCertified ? t("businessCenter.viewCertifications") : t("businessCenter.continueCertification")}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {pillars.map((pillar, i) => {
          const Icon = pillar.icon;
          return (
            <motion.button
              key={pillar.id}
              className={`w-full text-left p-5 rounded-2xl bg-black/50 border ${pillar.border} active:scale-[0.98] transition-all duration-200`}
              onClick={() => setLocation(pillar.route)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (isProfessional ? 0.08 : 0) + i * 0.07 }}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${pillar.accent} flex-shrink-0`}>
                  <Icon className={`h-6 w-6 ${pillar.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-white/55 mt-1 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0 mt-1" />
              </div>
            </motion.button>
          );
        })}

        <p className="text-center text-white/25 text-xs pb-4 pt-1">
          {t("businessCenter.newOpportunities")}
        </p>
      </div>
    </motion.div>
  );
}

function CertRow({
  label,
  sublabel,
  done,
  onClick,
}: {
  label: string;
  sublabel: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={done ? undefined : onClick}
      className="w-full flex items-center gap-2 text-left active:opacity-70 transition-opacity"
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-white/20 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${done ? "text-emerald-300" : "text-white/60"}`}>
          {label}
        </p>
      </div>
    </button>
  );
}
