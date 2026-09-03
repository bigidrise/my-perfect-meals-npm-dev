import { CheckCircle2, XCircle, AlertCircle, Info, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";

// Messaging guide content is the same for every partner — no fetch needed.
const APPROVED = [
  {
    label: "Company Description",
    text: "My Perfect Meals is an adaptive nutrition platform that helps users make food decisions based on their goals, dietary needs, preferences, health considerations, and lifestyle.",
  },
  {
    label: "Weight Management",
    text: "My Perfect Meals can support individuals whose goal is weight management by helping them build meals aligned with their nutrition targets and lifestyle.",
  },
  {
    label: "Flexibility",
    text: "Whether your goal is weight management, muscle building, performance, or simply eating better — My Perfect Meals adapts to you.",
  },
];

const PROHIBITED = [
  "My Perfect Meals is a weight-loss platform.",
  "My Perfect Meals treats diabetes.",
  "My Perfect Meals replaces a dietitian or physician.",
  "My Perfect Meals guarantees weight loss.",
  "My Perfect Meals cures or reverses a medical condition.",
  "My Perfect Meals is a medical treatment.",
  "Using My Perfect Meals will definitely result in [specific outcome].",
];

const DISCLAIMERS = [
  "Results vary based on individual adherence, health status, and lifestyle factors.",
  "My Perfect Meals is not a medical device and does not provide medical advice.",
  "Always consult a qualified healthcare provider before making significant dietary changes.",
];

export default function MessagingGuide() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4">
      {/* Academy CTA */}
      <button
        onClick={() => setLocation("/academy/platform-mastery/lesson/lesson-09")}
        className="w-full rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-4.5 w-4.5 text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">New partner?</p>
          <p className="text-xs text-orange-200/70 leading-relaxed mt-0.5">
            Complete the Marketing &amp; Brand Standards lesson in the Academy before promoting My Perfect Meals.
          </p>
        </div>
      </button>

      {/* Acknowledgment notice */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/60 leading-relaxed">
          By downloading or using these materials, you agree to follow the My Perfect Meals messaging and brand guidelines.
        </p>
      </div>

      {/* Approved language */}
      <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-bold text-white">Approved Language</p>
        </div>
        <div className="space-y-5">
          {APPROVED.map((item, i) => (
            <div key={i}>
              <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-1.5">
                {item.label}
              </p>
              <blockquote className="border-l-2 border-emerald-400/40 pl-3">
                <p className="text-sm text-white/80 leading-relaxed italic">"{item.text}"</p>
              </blockquote>
            </div>
          ))}
        </div>
      </div>

      {/* Do not say */}
      <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <XCircle className="h-4 w-4 text-red-400" />
          <p className="text-sm font-bold text-white">Do Not Say</p>
        </div>
        <div className="space-y-2.5">
          {PROHIBITED.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="h-3.5 w-3.5 text-red-400/50 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/70 leading-relaxed">"{item}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* Required disclaimers */}
      <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Required Disclaimers</p>
        </div>
        <div className="space-y-2.5">
          {DISCLAIMERS.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber-400/50 font-bold text-xs mt-0.5 flex-shrink-0">•</span>
              <p className="text-sm text-white/70 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
