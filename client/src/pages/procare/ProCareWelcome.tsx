import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, GraduationCap, User, Rocket, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NarrationBar } from "@/components/NarrationBar";
import { LegacyNarration } from "@/components/LegacyNarration";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useTranslation } from "react-i18next";

// i18n: leave for content team
const COPILOT_SECTIONS = [
  {
    heading: "Welcome to My Perfect Meals Professional",
    text: "I'm Chef Copilot, and before you dive in, I want you to understand exactly what's about to happen and why it's designed this way. Every My Perfect Meals professional completes a three-step onboarding before accessing the Studio. Not because it's a requirement. Because it works. Step one: you'll complete your own My Perfect Meals profile, generate your own nutrition plan, and experience the app exactly the way your future clients will. Step two: you'll complete Professional Certification, Platform Fundamentals, where you'll learn every feature of the platform, how to personalize nutrition, and how to onboard clients efficiently. Step three: Business and ProCare Success, where you'll learn to build your practice, manage clients, use the Studio, and grow recurring revenue. When you're finished, your Professional Studio and Business Suite will unlock and you'll enter them prepared, not guessing. Professionals who complete this onboarding are more confident, provide better client outcomes, and grow their businesses faster. That's not marketing. That's what we've seen.",
  },
];

const JOURNEY_STEPS = [
  {
    number: "1",
    icon: <User className="w-5 h-5 text-orange-400" />,
    titleKey: "procare.welcome.steps.experience.title",
    descriptionKey: "procare.welcome.steps.experience.description",
  },
  {
    number: "2",
    icon: <GraduationCap className="w-5 h-5 text-orange-400" />,
    titleKey: "procare.welcome.steps.fundamentals.title",
    descriptionKey: "procare.welcome.steps.fundamentals.description",
  },
  {
    number: "3",
    icon: <Rocket className="w-5 h-5 text-orange-400" />,
    titleKey: "procare.welcome.steps.business.title",
    descriptionKey: "procare.welcome.steps.business.description",
  },
];

const CERT_BENEFITS = [
  "procare.welcome.benefits.features",
  "procare.welcome.benefits.personalization",
  "procare.welcome.benefits.responsibleAI",
  "procare.welcome.benefits.clientOnboarding",
  "procare.welcome.benefits.automation",
  "procare.welcome.benefits.revenue",
  "procare.welcome.benefits.studio",
  "procare.welcome.benefits.clientQuestions",
];

export default function ProCareWelcome() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const { t } = useTranslation();

  const isTrainerWelcome = location === "/trainer-welcome";
  const isPhysicianWelcome = location === "/physician-welcome";
  const role: "trainer" | "physician" | null = isTrainerWelcome
    ? "trainer"
    : isPhysicianWelcome
      ? "physician"
      : null;
  const heroChefSrc = role
    ? "/assets/WelcomeChef2026.png"
    : "/assets/ProCareChef.png";

  // Returning professionals already have a role set — send them to their workspace
  useEffect(() => {
    if (!user) return;
    if (user.professionalRole === "trainer" || user.professionalRole === "physician") {
      setLocation("/pro-launchpad");
    }
  }, [user?.professionalRole]);

  const handleBegin = () => {
    if (role === "trainer" || role === "physician") {
      setLocation("/professional-onboarding-bridge");
    } else {
      setLocation("/procare-identity");
    }
  };

  const accountReadyKey =
    role === "trainer"
      ? "procare.welcome.accountReady.trainer"
      : role === "physician"
        ? "procare.welcome.accountReady.physician"
        : "procare.welcome.accountReady.professional";

  const cta = (
    <>
      {user?.onboardingCompletedAt ? (
        <div className="mb-2 text-center">
          <p className="text-xs text-white/40">{t("procare.welcome.profileComplete")}</p>
        </div>
      ) : null}
      <button
        onClick={handleBegin}
        className="w-full h-14 text-md font-bold rounded-2xl bg-orange-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        {t("procare.welcome.beginJourney")}
        <ArrowRight className="w-5 h-5" />
      </button>
    </>
  );

  return (
    <div className={`bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white ${isDesktop ? "pb-8" : "min-h-screen flex flex-col"}`}>
      {/* Scrollable content */}
      <div className={isDesktop ? "max-w-2xl mx-auto px-4 py-6" : "flex-1 overflow-y-auto px-4 pb-36"}>
        {!isDesktop && <div className="pt-10 pb-2" />}

        {/* In-content back button — visible on both mobile and desktop */}
        <button
          onClick={() => setLocation("/business-center")}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("procare.welcome.back")}
        </button>

        {/* Hero */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src={heroChefSrc}
            alt={t("procare.welcome.chefAlt")}
            className="w-56 h-auto"
          />
          <h1 className="text-3xl font-black mt-3 leading-tight">
            {t("procare.welcome.title")}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mt-2 max-w-xs">
            {t(accountReadyKey)}{" "}
            {t("procare.welcome.introduction")}
          </p>
        </div>

        {/* Copilot */}
        <LegacyNarration><div className="mb-6 px-4 py-3 rounded-xl bg-black/30 border border-orange-500/30">
          <p className="text-xs text-white/50 mb-2">
            Hear the full journey explained by Chef Copilot
          </p>
          <NarrationBar sections={COPILOT_SECTIONS} speedOverride="1.0" />
        </div></LegacyNarration>

        {/* 3-Step Journey */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400 mb-3">
            {t("procare.welcome.journeyHeading")}
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
                  <p className="text-sm font-semibold text-white leading-snug mb-1">{t(step.titleKey)}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{t(step.descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why it matters */}
        <div className="mb-6 p-4 rounded-2xl bg-black/30 border border-orange-500/20">
          <p className="text-sm font-bold text-white mb-3">{t("procare.welcome.certificationHeading")}</p>
          <div className="space-y-2">
            {CERT_BENEFITS.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-white/70 leading-relaxed">{t(benefit)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
          <p className="text-sm text-white/60 italic text-center leading-relaxed">
            {t("procare.welcome.closingStatement")}
          </p>
        </div>

        {/* CTA inline on desktop */}
        {isDesktop && (
          <div className="mt-6">
            {cta}
          </div>
        )}
      </div>

      {/* CTA fixed on mobile */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          {cta}
        </div>
      )}
    </div>
  );
}
