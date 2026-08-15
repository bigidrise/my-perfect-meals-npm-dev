import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import {
  useCoachingProfile,
  useSaveCoachingProfile,
  type CoachingProfilePayload,
} from "@/hooks/useCoachingProfile";

const COACHING_STYLES = [
  { value: "direct", labelKey: "coachingSetup.styles.direct.label", descKey: "coachingSetup.styles.direct.desc" },
  { value: "encouraging", labelKey: "coachingSetup.styles.encouraging.label", descKey: "coachingSetup.styles.encouraging.desc" },
  { value: "educational", labelKey: "coachingSetup.styles.educational.label", descKey: "coachingSetup.styles.educational.desc" },
  { value: "balanced", labelKey: "coachingSetup.styles.balanced.label", descKey: "coachingSetup.styles.balanced.desc" },
];

const ACCOUNTABILITY_PREFS = [
  { value: "push_hard", labelKey: "coachingSetup.accountability.pushHard.label", descKey: "coachingSetup.accountability.pushHard.desc" },
  { value: "encourage", labelKey: "coachingSetup.accountability.encourage.label", descKey: "coachingSetup.accountability.encourage.desc" },
  { value: "remind", labelKey: "coachingSetup.accountability.remind.label", descKey: "coachingSetup.accountability.remind.desc" },
  { value: "self_directed", labelKey: "coachingSetup.accountability.selfDirected.label", descKey: "coachingSetup.accountability.selfDirected.desc" },
];

// NOTE: "Medical Condition" (value: "medical") is a protected clinical string
// (see docs/localization/clinical-registry.json) and stays hardcoded.
const MOTIVATION_OPTIONS = [
  { value: "weight_loss", labelKey: "coachingSetup.motivations.weightLoss" },
  { value: "energy", labelKey: "coachingSetup.motivations.energy" },
  { value: "longevity", labelKey: "coachingSetup.motivations.longevity" },
  { value: "athletic", labelKey: "coachingSetup.motivations.athletic" },
  { value: "medical", label: "Medical Condition" },
  { value: "confidence", labelKey: "coachingSetup.motivations.confidence" },
  { value: "family", labelKey: "coachingSetup.motivations.family" },
  { value: "mental_clarity", labelKey: "coachingSetup.motivations.mentalClarity" },
];

const LIFESTYLE_FLAG_OPTIONS = [
  { value: "busy_schedule", labelKey: "coachingSetup.lifestyle.busySchedule" },
  { value: "frequent_travel", labelKey: "coachingSetup.lifestyle.frequentTravel" },
  { value: "shift_worker", labelKey: "coachingSetup.lifestyle.shiftWorker" },
  { value: "parent", labelKey: "coachingSetup.lifestyle.parent" },
  { value: "social_eater", labelKey: "coachingSetup.lifestyle.socialEater" },
  { value: "stress_eater", labelKey: "coachingSetup.lifestyle.stressEater" },
  { value: "picky_eater", labelKey: "coachingSetup.lifestyle.pickyEater" },
  { value: "budget_conscious", labelKey: "coachingSetup.lifestyle.budgetConscious" },
];

const CHALLENGE_OPTIONS = [
  { value: "meal_prep", labelKey: "coachingSetup.challenges.mealPrep" },
  { value: "cravings", labelKey: "coachingSetup.challenges.cravings" },
  { value: "consistency", labelKey: "coachingSetup.challenges.consistency" },
  { value: "social_pressure", labelKey: "coachingSetup.challenges.socialPressure" },
  { value: "emotional_eating", labelKey: "coachingSetup.challenges.emotionalEating" },
  { value: "time", labelKey: "coachingSetup.challenges.time" },
  { value: "motivation", labelKey: "coachingSetup.challenges.motivation" },
  { value: "knowledge", labelKey: "coachingSetup.challenges.knowledge" },
];

function PillButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-orange-600 text-white"
          : "bg-white/10 text-white/80 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

interface Props {
  onComplete?: () => void;
}

export default function CoachingProfileSetup({ onComplete }: Props) {
  const { t } = useTranslation();
  const { data: existing, isLoading } = useCoachingProfile();
  const saveMutation = useSaveCoachingProfile();

  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);

  const [coachingStyle, setCoachingStyle] = useState<string>("");
  const [accountabilityPref, setAccountabilityPref] = useState<string>("");
  const [motivations, setMotivations] = useState<string[]>([]);
  const [lifestyleFlags, setLifestyleFlags] = useState<string[]>([]);
  const [biggestChallenges, setBiggestChallenges] = useState<string[]>([]);

  useEffect(() => {
    if (existing) {
      setCoachingStyle(existing.coaching_style ?? "");
      setAccountabilityPref(existing.accountability_pref ?? "");
      setMotivations(existing.motivations ?? []);
      setLifestyleFlags(existing.lifestyle_flags ?? []);
      setBiggestChallenges(existing.biggest_challenges ?? []);
    }
  }, [existing]);

  function toggleMulti(
    value: string,
    current: string[],
    set: (v: string[]) => void
  ) {
    set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  }

  const steps = [
    {
      id: "style",
      title: t("coachingSetup.steps.style.title"),
      subtitle: t("coachingSetup.steps.style.subtitle"),
      content: (
        <div className="flex flex-wrap gap-3">
          {COACHING_STYLES.map((s) => (
            <div key={s.value} className="w-full">
              <button
                type="button"
                onClick={() => setCoachingStyle(s.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                  coachingStyle === s.value
                    ? "bg-orange-600 border-orange-500 text-white"
                    : "bg-white/10 border-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                <div className="font-semibold">{t(s.labelKey)}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    coachingStyle === s.value ? "text-orange-100" : "text-white/50"
                  }`}
                >
                  {t(s.descKey)}
                </div>
              </button>
            </div>
          ))}
        </div>
      ),
      isValid: () => coachingStyle !== "",
    },
    {
      id: "accountability",
      title: t("coachingSetup.steps.accountability.title"),
      subtitle: t("coachingSetup.steps.accountability.subtitle"),
      content: (
        <div className="space-y-2">
          {ACCOUNTABILITY_PREFS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAccountabilityPref(a.value)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                accountabilityPref === a.value
                  ? "bg-orange-600 border-orange-500 text-white"
                  : "bg-white/10 border-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              <div className="font-semibold">{t(a.labelKey)}</div>
              <div
                className={`text-xs mt-0.5 ${
                  accountabilityPref === a.value ? "text-orange-100" : "text-white/50"
                }`}
              >
                {t(a.descKey)}
              </div>
            </button>
          ))}
        </div>
      ),
      isValid: () => accountabilityPref !== "",
    },
    {
      id: "motivations",
      title: t("coachingSetup.steps.motivations.title"),
      subtitle: t("coachingSetup.steps.motivations.subtitle"),
      content: (
        <div className="flex flex-wrap gap-2">
          {MOTIVATION_OPTIONS.map((m) => (
            <PillButton
              key={m.value}
              selected={motivations.includes(m.value)}
              onClick={() => toggleMulti(m.value, motivations, setMotivations)}
            >
              {m.labelKey ? t(m.labelKey) : m.label}
            </PillButton>
          ))}
        </div>
      ),
      isValid: () => motivations.length > 0,
    },
    {
      id: "lifestyle",
      title: t("coachingSetup.steps.lifestyle.title"),
      subtitle: t("coachingSetup.steps.lifestyle.subtitle"),
      content: (
        <div className="flex flex-wrap gap-2">
          {LIFESTYLE_FLAG_OPTIONS.map((l) => (
            <PillButton
              key={l.value}
              selected={lifestyleFlags.includes(l.value)}
              onClick={() =>
                toggleMulti(l.value, lifestyleFlags, setLifestyleFlags)
              }
            >
              {t(l.labelKey)}
            </PillButton>
          ))}
        </div>
      ),
      isValid: () => lifestyleFlags.length > 0,
    },
    {
      id: "challenges",
      title: t("coachingSetup.steps.challenges.title"),
      subtitle: t("coachingSetup.steps.challenges.subtitle"),
      content: (
        <div className="flex flex-wrap gap-2">
          {CHALLENGE_OPTIONS.map((c) => (
            <PillButton
              key={c.value}
              selected={biggestChallenges.includes(c.value)}
              onClick={() =>
                toggleMulti(c.value, biggestChallenges, setBiggestChallenges)
              }
            >
              {t(c.labelKey)}
            </PillButton>
          ))}
        </div>
      ),
      isValid: () => biggestChallenges.length > 0,
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  async function handleNext() {
    if (isLast) {
      await handleSave();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function handleSave() {
    const payload: CoachingProfilePayload = {
      coaching_style: coachingStyle,
      accountability_pref: accountabilityPref,
      motivations,
      lifestyle_flags: lifestyleFlags,
      biggest_challenges: biggestChallenges,
    };
    await saveMutation.mutateAsync(payload);
    setSaved(true);
    setTimeout(() => onComplete?.(), 1200);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/40">
        {t("coachingSetup.loading")}
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-12 h-12 text-orange-400" />
        <p className="text-white text-lg font-semibold">{t("coachingSetup.savedTitle")}</p>
        <p className="text-white/60 text-sm">{t("coachingSetup.savedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 mb-2">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= step ? "bg-orange-500" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      <Section
        title={currentStep.title}
        subtitle={currentStep.subtitle}
      >
        {currentStep.content}
      </Section>

      <div className="flex items-center gap-3 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-all"
          >
            {t("coachingSetup.back")}
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!currentStep.isValid() || saveMutation.isPending}
          className="flex-1 px-5 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-500 transition-all"
        >
          {saveMutation.isPending
            ? t("coachingSetup.saving")
            : isLast
            ? t("coachingSetup.saveProfile")
            : t("coachingSetup.next")}
        </button>
      </div>

      {saveMutation.isError && (
        <p className="text-red-400 text-sm text-center">
          {t("coachingSetup.error")}
        </p>
      )}
    </div>
  );
}
