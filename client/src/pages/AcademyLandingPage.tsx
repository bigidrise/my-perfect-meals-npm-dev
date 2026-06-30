import { useLocation } from "wouter";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Brain,
  Utensils,
  HeartHandshake,
  Unlock,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const PHASE1_MODULES = [
  {
    number: "01",
    title: "What is My Perfect Meals?",
    description:
      "The history, mission, and vision — who MPM serves and why it exists differently from every other nutrition tool.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "How the Platform Works",
    description:
      "Every feature, every builder, navigation, the dashboard, macro calculator, restaurant guide, Recipe Scan, Ingredient Intelligence, Fridge Rescue, and more.",
    icon: Utensils,
  },
  {
    number: "03",
    title: "Adaptive Nutrition",
    description:
      "Why My Perfect Meals personalizes differently than generic AI tools — medical guardrails, dietary identity, cultural preferences, and behavioral context.",
    icon: Brain,
  },
  {
    number: "04",
    title: "How to Market My Perfect Meals",
    description:
      "What to say, what not to say, how to explain the AI, personalization, restaurants, and Recipe Scan — without making weight-loss claims or medical promises.",
    icon: TrendingUp,
  },
  {
    number: "05",
    title: "Behavior, Psychology, and Working With People",
    description:
      "Client communication, behavior change, habit formation, and how to help people actually use the platform in their real lives.",
    icon: HeartHandshake,
  },
];

const PHASE2_TOPICS = [
  "Inviting and managing clients",
  "Care Team setup and collaboration",
  "Client Portal and client view",
  "Client folders and organization",
  "Biometrics tracking and review",
  "Provider Notes and documentation",
  "Dashboard and workflow overview",
];

export default function AcademyLandingPage() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Center
          </button>
          <h1 className="text-lg font-bold text-white">Academy</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >

        {/* ── HERO ─────────────────────────────────────────────── */}
        <motion.div
          className="text-center py-4 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/25">
              <GraduationCap className="h-10 w-10 text-orange-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              My Perfect Meals Academy
            </h2>
            <p className="text-orange-400 text-sm font-medium mt-1">
              One certification. One platform. Everything you need to represent MPM.
            </p>
          </div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
            The Academy teaches partners and professionals how to understand, use, explain, and represent My Perfect Meals — so they can help the people they serve get real results.
          </p>
        </motion.div>

        {/* ── PHASE 1 ──────────────────────────────────────────── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Phase header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                  Phase 1
                </p>
                <h3 className="text-base font-bold text-white">
                  Platform Certification
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Required for all partners and professionals
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                <span className="text-orange-300 text-xs font-semibold">5 modules</span>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div className="divide-y divide-white/5">
            {PHASE1_MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.div
                  key={mod.number}
                  className="px-5 py-3.5 flex items-start gap-3"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                >
                  <div className="p-1.5 rounded-lg bg-orange-500/15 flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25">{mod.number}</span>
                      <span className="text-sm font-semibold text-white leading-snug">
                        {mod.title}
                      </span>
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Phase 1 result */}
          <div className="px-5 py-4 bg-orange-500/10 border-t border-orange-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-orange-300">
                Complete Phase 1 → Earn your My Perfect Meals Certification
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── PHASE 2 ──────────────────────────────────────────── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
        >
          {/* Phase header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                  Phase 2
                </p>
                <h3 className="text-base font-bold text-white">
                  ProCare Training
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Only for professionals who will manage clients through ProCare
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex-shrink-0">
                <span className="text-white/50 text-xs font-semibold">Optional</span>
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-xs text-white/50 leading-relaxed mb-3">
              Physicians, dietitians, coaches, trainers, nurse practitioners, health coaches, and any other professional using ProCare to manage clients complete this before going live.
            </p>
            {PHASE2_TOPICS.map((topic, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
                <span className="text-sm text-white/70">{topic}</span>
              </div>
            ))}
          </div>

          {/* Phase 2 result */}
          <div className="px-5 py-4 bg-white/5 border-t border-white/8">
            <div className="flex items-start gap-2.5">
              <Unlock className="h-4 w-4 text-white/50 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white/80">
                  Complete Phase 2 → ProCare access is enabled
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  No second certificate. This is software onboarding, not a credential.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── PHILOSOPHY CALLOUT ───────────────────────────────── */}
        <motion.div
          className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-start gap-2.5">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-200/80 leading-relaxed">
              After you earn your certification, everything stays accessible. Come back to any lesson anytime — no retest, no penalty. As the platform grows, the Academy grows with it.
            </p>
          </div>
        </motion.div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <button
            onClick={() => setLocation("/business-center/affiliate")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 active:bg-orange-700 active:scale-[0.98] transition-all duration-150 font-semibold text-white text-sm shadow-lg shadow-orange-900/30"
          >
            <GraduationCap className="h-5 w-5" />
            Start Certification
            <ChevronRight className="h-4 w-4 opacity-70" />
          </button>
          <p className="text-center text-white/30 text-xs pb-2">
            Already certified? Your progress and certificate are saved automatically.
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}
