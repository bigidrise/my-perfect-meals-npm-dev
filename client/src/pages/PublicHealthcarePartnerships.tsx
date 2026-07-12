import { useLocation } from "wouter";
import { ArrowLeft, Stethoscope, CheckCircle2, HeartPulse, ChevronRight, ExternalLink, Users, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

const CONSULTATION_FORM = "https://forms.gle/7wAMmDA1vz1wCzzKA";

const WHO_FOR = [
  "Physicians and medical practices",
  "Registered dietitians and nutrition professionals",
  "Functional medicine and integrative health clinics",
  "Hormone and metabolic health clinics",
  "Hospitals and health systems",
  "Concierge medicine practices",
  "Wellness centers and patient-care organizations",
  "Oncology and chronic disease care teams",
];

const PLATFORM_OFFERS = [
  { heading: "Clinical nutrition guardrails", body: "Dietary recommendations are filtered through user-declared medical conditions, medications, and clinical protocols — so the platform works safely alongside your care plans." },
  { heading: "GLP-1 and metabolic support", body: "Built-in nutrition logic for GLP-1 users, diabetes management, cardiovascular risk reduction, and anti-inflammatory protocols." },
  { heading: "Care team collaboration tools", body: "Clinicians can configure dietary parameters, assign meal plans, and monitor patient nutrition adherence through dedicated professional dashboards." },
  { heading: "Patient engagement and retention", body: "Patients stay engaged between appointments through personalized meal generation, macro tracking, and an adaptive nutrition system that evolves with their condition." },
  { heading: "Oncology support mode", body: "A dedicated clinical nutrition mode for oncology patients with physician-assigned dietary restrictions and a focus on appropriate nutrition during treatment." },
];

const WHAT_HAPPENS = [
  { step: "1", label: "Submit a consultation request", sub: "Fill out the form below. Every request is reviewed personally." },
  { step: "2", label: "Discovery conversation", sub: "We'll schedule a call to understand your practice, patient population, and clinical workflow." },
  { step: "3", label: "Partnership review", sub: "We'll determine the right partnership structure for your organization — Founding Partner, clinical integration, or white label." },
  { step: "4", label: "Implementation planning", sub: "Accepted partners receive dedicated onboarding, team training, and implementation support." },
];

export default function PublicHealthcarePartnerships() {
  const [location, setLocation] = useLocation();
  const isPublicRoute = location.startsWith("/partners");
  const backDest = isPublicRoute ? "/partners" : "/business-center/partners";
  const backLabel = isPublicRoute ? "Partner Programs" : "Partner Programs";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/8"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation(backDest)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <h1 className="text-base font-bold text-white truncate">Healthcare & Clinical</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-3">
            <Stethoscope className="h-6 w-6 text-orange-400" />
          </div>
          <h2 className="text-white font-bold text-base mb-2">Healthcare & Clinical Partnerships</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            My Perfect Meals works with physicians, registered dietitians, clinics, hospitals, and patient-care organizations to integrate adaptive nutrition into clinical and care workflows.
          </p>
        </motion.div>

        {/* Who this is for */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Who This Is For</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {WHO_FOR.map((item, i) => (
              <span
                key={i}
                className="text-xs bg-white/8 border border-white/10 text-gray-300 rounded-full px-3 py-1"
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>

        {/* What the platform offers */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What the Platform Offers Clinical Partners</h3>
          </div>
          <div className="space-y-4">
            {PLATFORM_OFFERS.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-orange-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-snug">{item.heading}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Important principle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Our Clinical Philosophy</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            My Perfect Meals is not marketed as a medical treatment, diagnostic tool, or guaranteed outcome system. It is an adaptive nutrition platform that respects clinical boundaries.
          </p>
          <div className="space-y-2.5">
            {[
              "Medical conditions and medications are always respected as the highest priority in meal generation.",
              "Clinical partners retain full authority over patient care decisions — the platform supports, never replaces, clinical judgment.",
              "We do not make treatment claims. We provide personalized, clinically-aware nutrition support.",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* What happens next */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">What Happens After You Apply</h3>
          <div className="space-y-4">
            {WHAT_HAPPENS.map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 text-orange-400 text-xs font-bold">
                  {item.step}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-snug">{item.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5"
        >
          <h3 className="text-orange-300 font-bold text-sm mb-1">Request a Partnership Consultation</h3>
          <p className="text-gray-300 text-xs leading-relaxed mb-4">
            Tell us about your practice or organization. Every request is reviewed personally. Submitting is not a commitment — it's the start of a conversation.
          </p>
          <a
            href={CONSULTATION_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-orange-600 text-white rounded-xl px-4 py-3.5 font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <span>Request Healthcare Partnership Consultation</span>
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
          </a>
          <p className="text-gray-500 text-xs text-center mt-3">
            Not a commitment. The MPM team reviews every request personally.
          </p>
        </motion.div>

        {/* Not right fit */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-center pb-4"
        >
          <p className="text-gray-500 text-xs mb-2">Looking for a different partnership type?</p>
          <button
            onClick={() => setLocation(backDest)}
            className="text-orange-400 text-xs font-medium underline underline-offset-2"
          >
            ← View all partner programs
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
