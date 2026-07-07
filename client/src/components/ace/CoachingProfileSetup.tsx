import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  useCoachingProfile,
  useSaveCoachingProfile,
  type CoachingProfilePayload,
} from "@/hooks/useCoachingProfile";

const COACHING_STYLES = [
  { value: "direct", label: "Direct", description: "Tell me what to do — no fluff" },
  { value: "encouraging", label: "Encouraging", description: "Positive reinforcement and support" },
  { value: "educational", label: "Educational", description: "Explain the why behind every choice" },
  { value: "balanced", label: "Balanced", description: "Mix of all approaches" },
];

const ACCOUNTABILITY_PREFS = [
  { value: "push_hard", label: "Push Me Hard", description: "Hold me accountable strictly" },
  { value: "encourage", label: "Encourage Me", description: "Cheer me on when I slip" },
  { value: "remind", label: "Just Remind Me", description: "Gentle nudges are enough" },
  { value: "self_directed", label: "Self-Directed", description: "I motivate myself" },
];

const MOTIVATION_OPTIONS = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "energy", label: "More Energy" },
  { value: "longevity", label: "Longevity" },
  { value: "athletic", label: "Athletic Performance" },
  { value: "medical", label: "Medical Condition" },
  { value: "confidence", label: "Feel Confident" },
  { value: "family", label: "Family Health" },
  { value: "mental_clarity", label: "Mental Clarity" },
];

const LIFESTYLE_FLAG_OPTIONS = [
  { value: "busy_schedule", label: "Busy Schedule" },
  { value: "frequent_travel", label: "Frequent Travel" },
  { value: "shift_worker", label: "Shift Worker" },
  { value: "parent", label: "Parent / Caregiver" },
  { value: "social_eater", label: "Social Eater" },
  { value: "stress_eater", label: "Stress Eater" },
  { value: "picky_eater", label: "Picky Eater" },
  { value: "budget_conscious", label: "Budget-Conscious" },
];

const CHALLENGE_OPTIONS = [
  { value: "meal_prep", label: "Meal Prep" },
  { value: "cravings", label: "Cravings" },
  { value: "consistency", label: "Staying Consistent" },
  { value: "social_pressure", label: "Social Pressure" },
  { value: "emotional_eating", label: "Emotional Eating" },
  { value: "time", label: "Not Enough Time" },
  { value: "motivation", label: "Motivation" },
  { value: "knowledge", label: "Knowing What to Eat" },
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
      title: "How would you like to be coached?",
      subtitle: "Choose the communication style that feels right for you",
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
                <div className="font-semibold">{s.label}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    coachingStyle === s.value ? "text-orange-100" : "text-white/50"
                  }`}
                >
                  {s.description}
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
      title: "How should we hold you accountable?",
      subtitle: "Pick what motivates you most",
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
              <div className="font-semibold">{a.label}</div>
              <div
                className={`text-xs mt-0.5 ${
                  accountabilityPref === a.value ? "text-orange-100" : "text-white/50"
                }`}
              >
                {a.description}
              </div>
            </button>
          ))}
        </div>
      ),
      isValid: () => accountabilityPref !== "",
    },
    {
      id: "motivations",
      title: "What drives you?",
      subtitle: "Select all that apply",
      content: (
        <div className="flex flex-wrap gap-2">
          {MOTIVATION_OPTIONS.map((m) => (
            <PillButton
              key={m.value}
              selected={motivations.includes(m.value)}
              onClick={() => toggleMulti(m.value, motivations, setMotivations)}
            >
              {m.label}
            </PillButton>
          ))}
        </div>
      ),
      isValid: () => motivations.length > 0,
    },
    {
      id: "lifestyle",
      title: "Which describe your lifestyle?",
      subtitle: "Select all that apply — we'll tailor advice around these",
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
              {l.label}
            </PillButton>
          ))}
        </div>
      ),
      isValid: () => lifestyleFlags.length > 0,
    },
    {
      id: "challenges",
      title: "What are your biggest challenges?",
      subtitle: "Be honest — this helps us focus on what actually matters",
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
              {c.label}
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
        Loading your profile...
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-12 h-12 text-orange-400" />
        <p className="text-white text-lg font-semibold">Profile saved!</p>
        <p className="text-white/60 text-sm">Your coaching profile is ready.</p>
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
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!currentStep.isValid() || saveMutation.isPending}
          className="flex-1 px-5 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-500 transition-all"
        >
          {saveMutation.isPending
            ? "Saving..."
            : isLast
            ? "Save Profile"
            : "Next"}
        </button>
      </div>

      {saveMutation.isError && (
        <p className="text-red-400 text-sm text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
