import { useLocation } from "wouter";
import { ArrowLeft, Star, Users, CheckCircle2, TrendingUp, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const FOUNDING_PARTNER_FORM = "https://forms.gle/i6NsVnb3hirSgGTz5";

const WHO_FOR = [
  "Health Coaches",
  "Nutrition Coaches",
  "Functional Medicine Practices",
  "Wellness Clinics",
  "Fitness Organizations",
  "Education Organizations",
  "Corporate Wellness Programs",
];

const BENEFITS = [
  { label: "Early access to new features", sub: "See and shape what's coming before anyone else" },
  { label: "Priority support", sub: "Direct line to the MPM team — not a ticket queue" },
  { label: "Influence on platform development", sub: "Your feedback shapes what gets built next" },
  { label: "Founding Partner recognition", sub: "Permanently recognized as a program founder" },
  { label: "Reduced Founding Partner pricing", sub: "Locked-in rates that reflect your early commitment" },
];

const EXPECTATIONS = [
  "Active platform usage with real members or clients",
  "Ongoing feedback through structured check-ins",
  "Participation in feature testing before public release",
  "Participation in onboarding refinement",
  "Willingness to share implementation feedback, workflow insights, and outcomes",
];

const PRICING_DRIVERS = [
  "Organization size and member count",
  "Number of providers, coaches, or staff",
  "Level of support and onboarding required",
  "Customization and branding requirements",
  "Implementation complexity",
];

export default function FoundingPartnerProgram() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28 text-white`}
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
            Back
          </button>
          <h1 className="text-lg font-bold text-white">Founding Partner Program</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-orange-600/15 border border-orange-500/25 rounded-2xl p-5 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-orange-600/30 flex items-center justify-center mx-auto mb-3">
            <Star className="h-6 w-6 text-orange-400" />
          </div>
          <h2 className="text-white font-bold text-base mb-1">Intentionally Limited</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            The Founding Partner Program is open to a very small number of organizations. Founding Partners work directly with the MPM team to validate, refine, and improve the platform through real-world implementation.
          </p>
        </motion.div>

        {/* Section 1 — What Is a Founding Partner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Is a Founding Partner?</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed">
            Founding Partners are real businesses implementing My Perfect Meals with real members. In exchange for early access and reduced pricing, Founding Partners participate in refining the platform — sharing workflow feedback, client outcomes, retention data, and candid insights that help the product improve faster than it could in isolation.
          </p>
          <div className="mt-3 space-y-1.5">
            {["Provider feedback", "Client feedback", "Workflow feedback", "Business feedback", "Retention data", "Testimonials and case studies"].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/55 text-xs">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Section 2 — Ideal Founding Partners */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Ideal Founding Partners</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {WHO_FOR.map((role, i) => (
              <span key={i} className="text-xs bg-white/8 border border-white/10 text-white/65 rounded-full px-3 py-1">
                {role}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Section 3 — Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Founding Partner Benefits</h3>
          </div>
          <div className="space-y-3">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-orange-600/25 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-orange-400" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium leading-snug">{b.label}</div>
                  <div className="text-white/45 text-xs mt-0.5">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Section 4 — Expectations */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What We Expect</h3>
          </div>
          <div className="space-y-2">
            {EXPECTATIONS.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/65 text-sm leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Section 5 — Investment */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Founding Partner Investment</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-black/40 border border-white/8 rounded-xl p-3">
              <div className="text-white/40 text-xs mb-1">Setup Investment</div>
              <div className="text-white font-bold text-sm">$1,500 – $3,000</div>
              <div className="text-white/35 text-xs mt-1">one-time</div>
            </div>
            <div className="bg-black/40 border border-white/8 rounded-xl p-3">
              <div className="text-white/40 text-xs mb-1">Monthly Investment</div>
              <div className="text-white font-bold text-sm">$297 – $997</div>
              <div className="text-white/35 text-xs mt-1">per month</div>
            </div>
          </div>

          <div className="border-t border-white/8 pt-3">
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Final pricing depends on</p>
            <div className="space-y-1.5">
              {PRICING_DRIVERS.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                  <span className="text-white/50 text-xs">{d}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs leading-relaxed mt-3 border-t border-white/5 pt-3">
            Founding Partner pricing reflects a meaningful discount from standard white label rates in recognition of the early commitment, feedback participation, and trust required of this program.
          </p>
        </motion.div>

        {/* Section 6 — CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-orange-600/10 border border-orange-500/20 rounded-2xl p-5"
        >
          <h3 className="text-orange-300 font-bold text-sm mb-1">Apply for Founding Partner Consideration</h3>
          <p className="text-white/55 text-xs leading-relaxed mb-4">
            This program is intentionally limited. Applications are reviewed personally by the MPM team. Submitting a request is not a commitment — it's the start of a conversation.
          </p>

          <a
            href={FOUNDING_PARTNER_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-orange-600 text-white rounded-xl px-4 py-3.5 font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <span>Request Founding Partner Consultation</span>
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          </a>

          <p className="text-white/25 text-xs text-center mt-3">
            Not a commitment. The MPM team reviews every request personally.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
