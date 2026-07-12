import { useLocation } from "wouter";
import {
  ArrowLeft, Stethoscope, CheckCircle2, HeartPulse, ExternalLink,
  Users, ClipboardList, Activity, Shield, Leaf, Brain, Zap,
  Building2, ChevronRight, FlaskConical,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_HEADER } from "@/components/BusinessCenterShell";

const CONSULTATION_FORM = "https://forms.gle/7wAMmDA1vz1wCzzKA";

const WHO_FOR = [
  "Physicians and medical practices",
  "Registered dietitians and nutrition professionals",
  "Functional medicine and integrative health clinics",
  "Hormone and metabolic health clinics",
  "Endocrinology practices",
  "Diabetes and weight-management programs",
  "Cardiovascular and preventive-care programs",
  "Hospitals and health systems",
  "Concierge and membership medicine practices",
  "Wellness centers and patient-care organizations",
  "Oncology and chronic-disease care teams",
  "Bariatric and GLP-1 support programs",
  "Rehabilitation and recovery programs",
  "Multidisciplinary care organizations",
];

const PATIENT_GAP_QUESTIONS = [
  "What should I eat today?",
  "What can I order at a restaurant?",
  "How do I reach my protein target?",
  "What should I eat while taking a GLP-1 medication?",
  "How do I follow my provider's recommendations without eating the same foods every day?",
  "How should I adjust when my appetite, schedule, symptoms, blood sugar, or treatment changes?",
];

const PLATFORM_FEATURES = [
  {
    icon: Shield,
    heading: "Clinically Aware Nutrition Guardrails",
    body: "Dietary recommendations can account for user-declared medical conditions, medications, allergies, dietary restrictions, active clinical protocols, and professional guidance. Clinical considerations are applied before convenience, preference, performance, or commercial recommendations.",
  },
  {
    icon: Activity,
    heading: "GLP-1 and Metabolic Nutrition Support",
    body: "Specialized nutrition support for GLP-1 medications, reduced appetite, protein adequacy, lean-mass preservation, hydration, digestive concerns, diabetes, blood-glucose awareness, cardiovascular risk, and sustainable weight management.",
  },
  {
    icon: Brain,
    heading: "Hormone and Thyroid-Aware Nutrition Context",
    body: "Dietary context support for hypothyroidism, Hashimoto's, hyperthyroid considerations, menopause, perimenopause, hormone optimization, metabolic symptoms, and physician-directed clinical protocols.",
  },
  {
    icon: FlaskConical,
    heading: "Diabetes and Blood-Glucose Support",
    body: "Food decisions with greater awareness of carbohydrate quantity and type, fiber, protein pairing, meal timing, blood-glucose context, user-specific guardrails, and saved meals associated with different blood-glucose responses.",
  },
  {
    icon: Leaf,
    heading: "Anti-Inflammatory and Cardiovascular Support",
    body: "Meal-generation logic that prioritizes anti-inflammatory food choices, fiber-rich meals, lean protein, healthy fats, sodium awareness, and cardiovascular risk reduction — personalized to the user's preferences and restrictions.",
  },
  {
    icon: HeartPulse,
    heading: "Oncology Nutrition Support",
    body: "A dedicated framework for use alongside qualified clinical care, including physician-assigned restrictions, symptom-aware meal considerations, protein and calorie awareness, hydration, and easier options during treatment. No treatment claims are made.",
  },
  {
    icon: Zap,
    heading: "Adaptive Meal Planning",
    body: "Patients receive meal ideas based on calorie and macro targets, medical and dietary context, food preferences, allergies, cuisine preferences, schedule, appetite, cooking ability, household needs, and active care protocols.",
  },
  {
    icon: Users,
    heading: "Care-Team and Professional Collaboration",
    body: "Qualified professionals may configure dietary parameters, assign nutrition protocols, review patient nutrition information, monitor adherence indicators, organize patients by program or condition, and support patients between appointments.",
  },
];

const USE_CASES = [
  { title: "Patient Nutrition Support", body: "Provide selected patients with personalized meal generation, planning, tracking, and education between appointments." },
  { title: "GLP-1 Programs", body: "Support patients with practical guidance related to appetite changes, adequate protein, meal size, hydration, digestion, and long-term eating habits." },
  { title: "Metabolic & Weight-Management Programs", body: "Extend the organization's nutritional framework beyond the clinic through adaptive meal planning and continued engagement." },
  { title: "Concierge & Membership Medicine", body: "Add an ongoing nutrition-support resource to a premium or membership-based care model." },
  { title: "Hormone & Thyroid Programs", body: "Translate provider-approved nutritional priorities into everyday meals without relying exclusively on static handouts." },
  { title: "Diabetes Programs", body: "Help patients apply carbohydrate, fiber, protein, and meal-composition guidance to daily food choices." },
  { title: "Oncology & Chronic-Care Programs", body: "Offer structured nutrition support that can adapt to restrictions, appetite, symptoms, and care-team guidance." },
  { title: "Enterprise & White Label Deployment", body: "Implement across a practice, clinic, care team, hospital program, or larger healthcare organization — with optional branded experience." },
];

const ORG_BENEFITS = [
  { label: "Extend Care Between Visits", body: "Patients receive support when they are making actual food decisions — not only during scheduled appointments." },
  { label: "Improve Practical Adherence", body: "Convert broad nutritional instructions into meals, substitutions, restaurant choices, and daily actions." },
  { label: "Reduce Repetitive Education", body: "Providers and staff can spend less time repeatedly explaining foundational nutrition concepts to every patient." },
  { label: "Strengthen Patient Engagement", body: "Adaptive tools, check-ins, meal planning, progress tracking, and personalized education keep patients connected." },
  { label: "Support Program Retention", body: "Patients who understand what to do between visits may be more likely to remain engaged with the care process." },
  { label: "Expand Service Value", body: "My Perfect Meals may become part of a weight-management, GLP-1, metabolic-health, hormone, diabetes, wellness, or membership offering." },
  { label: "Create New Partnership Opportunities", body: "Depending on the agreement, organizations may explore referral revenue, program integration, enterprise licensing, or a branded deployment." },
];

const PHILOSOPHY_POINTS = [
  "Clinical safety takes priority over convenience, preference, performance, and commercial recommendations.",
  "Medical conditions, medications, allergies, restrictions, and active professional protocols must be respected.",
  "Clinical partners retain authority over diagnosis, treatment, medication, and patient-care decisions.",
  "The platform supports professional judgment; it does not replace it.",
  "My Perfect Meals does not make treatment or cure claims.",
  "When available information is incomplete, the platform requests additional information rather than assume.",
  "Products or partner services are never recommended merely because a partner sells them.",
  "Any commercial recommendation must follow an independent determination that it is appropriate for the user.",
];

const PARTNERSHIP_PATHS = [
  { title: "Clinical Referral Partnership", body: "Introduce appropriate patients or clients to My Perfect Meals and participate in an agreed referral structure." },
  { title: "Founding Partner", body: "Help shape the platform through clinical expertise, patient access, protocols, education, products, content, or distribution." },
  { title: "Practice or Clinic Integration", body: "Use My Perfect Meals as part of an existing clinical, wellness, metabolic, hormone, or weight-management program." },
  { title: "ProCare Professional Access", body: "Allow authorized professionals to manage nutrition-related patient or client workflows through dedicated professional tools." },
  { title: "Enterprise Partnership", body: "Deploy My Perfect Meals across a larger clinic group, hospital program, care network, or healthcare organization." },
  { title: "White Label Solution", body: "Explore a branded implementation designed around the organization's identity, services, protocols, and patient population." },
];

const NEED_TO_KNOW = [
  "Your practice or organization",
  "Your patient population",
  "Your clinical specialties",
  "Your current nutrition services",
  "Your existing workflow",
  "The problems you want to solve",
  "How many providers or team members may need access",
  "How many patients or members may use the platform",
  "Whether you are exploring referrals, clinical integration, enterprise access, or white label",
  "Your compliance, privacy, reporting, and implementation requirements",
  "What success would look like for your organization",
];

const WHAT_HAPPENS = [
  {
    step: "1",
    label: "Submit a Consultation Request",
    sub: "Tell us about your practice, organization, patient population, and goals. Every request is reviewed personally.",
  },
  {
    step: "2",
    label: "Organization Review",
    sub: "We review your website, services, programs, specialties, and potential partnership fit before the call.",
  },
  {
    step: "3",
    label: "Discovery Conversation",
    sub: "We schedule a conversation to understand your workflow, objectives, patient needs, and implementation requirements.",
  },
  {
    step: "4",
    label: "Partnership Recommendation",
    sub: "We identify the most appropriate path: referral partnership, Founding Partner, clinical integration, ProCare access, enterprise, or white label.",
  },
  {
    step: "5",
    label: "Implementation Planning",
    sub: "Accepted partners receive a defined onboarding, training, content, technical, and implementation plan based on the approved structure.",
  },
];

const IMPLEMENTATION_ITEMS = [
  "Organizational onboarding",
  "Professional account setup",
  "Team-member access",
  "Staff training",
  "Platform certification",
  "Patient enrollment planning",
  "Clinical protocol review",
  "Dietary guardrail configuration",
  "Custom educational content",
  "Program-specific onboarding",
  "Technical integration planning",
  "Branded materials",
  "Referral and revenue-tracking setup",
  "Ongoing implementation support",
];

export default function PublicHealthcarePartnerships() {
  const [location, setLocation] = useLocation();
  const isPublicRoute = location.startsWith("/partners");
  const backDest = isPublicRoute ? "/partners" : "/business-center/partners";
  const backLabel = "Partner Programs";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-28"
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
            onClick={() => setLocation(backDest)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <h1 className="text-base font-bold text-white truncate">Healthcare & Clinical Partnerships</h1>
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
          <h2 className="text-white font-bold text-lg mb-2">Extend Nutrition Support Beyond the Appointment</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            My Perfect Meals works with physicians, registered dietitians, clinics, hospitals, and patient-care organizations to integrate adaptive nutrition support into real clinical and care workflows.
          </p>
        </motion.div>

        {/* The Problem */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">The Gap We Help Close</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Most patients do not struggle because they have never been told what healthy eating looks like. They struggle with applying general instructions to everyday decisions.
          </p>
          <div className="space-y-2 mb-4">
            {PATIENT_GAP_QUESTIONS.map((q, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm italic leading-snug">{q}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-4 space-y-2">
            <p className="text-gray-300 text-sm leading-relaxed">
              My Perfect Meals is designed to help close that gap — giving patients practical, personalized nutrition support between appointments while allowing qualified professionals to maintain authority over clinical decisions, dietary parameters, and care priorities.
            </p>
          </div>
        </motion.div>

        {/* Who This Is For */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Who This Is For</h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mb-3">
            Partnerships can range from a single provider using My Perfect Meals with selected patients to larger clinical, enterprise, or branded implementations.
          </p>
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

        {/* Platform Features */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What the Platform Offers Clinical Partners</h3>
          </div>
          <div className="space-y-4">
            {PLATFORM_FEATURES.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-snug">{item.heading}</p>
                    <p className="text-gray-400 text-xs mt-1 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* How Organizations Can Use MPM */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">How Clinical Organizations Can Use My Perfect Meals</h3>
          </div>
          <div className="space-y-3">
            {USE_CASES.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                <p className="text-white text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Benefits for the Organization */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Benefits for the Clinical Organization</h3>
          </div>
          <div className="space-y-3">
            {ORG_BENEFITS.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-orange-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-snug">{item.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-gray-400 text-xs leading-relaxed italic">
              All commercial terms are determined through the consultation and partnership-review process.
            </p>
          </div>
        </motion.div>

        {/* What Makes MPM Different */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Makes My Perfect Meals Different</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            My Perfect Meals is not simply a database of recipes or a generic meal planner. The platform is being developed as an adaptive nutrition and coaching system that organizes information about the individual, identifies relevant patterns, applies professional and clinical guardrails, and provides practical education and next-step guidance.
          </p>
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Generic tools ask:</p>
              <p className="text-gray-300 text-sm italic">"What is a healthy meal?"</p>
            </div>
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-3.5">
              <p className="text-orange-400 text-xs uppercase tracking-wider font-semibold mb-1">My Perfect Meals is built to consider:</p>
              <p className="text-white text-sm italic leading-relaxed">"Given what we know about this person, their health context, their goals, their preferences, and their current situation — what is an appropriate next nutrition decision?"</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mt-4">
            That intelligence will continue to grow as the platform expands.
          </p>
        </motion.div>

        {/* Clinical Philosophy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Our Clinical Philosophy</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            My Perfect Meals is not marketed as a medical treatment, diagnostic tool, or guaranteed-outcome system. It is an adaptive nutrition platform designed to respect clinical boundaries.
          </p>
          <div className="space-y-2.5">
            {PHILOSOPHY_POINTS.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Partnership Paths */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Potential Partnership Paths</h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mb-4">
            A healthcare organization may qualify for more than one path. The appropriate structure is determined after we understand the organization's goals, workflow, and implementation requirements.
          </p>
          <div className="space-y-3">
            {PARTNERSHIP_PATHS.map((path, i) => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">{path.title}</p>
                <p className="text-gray-300 text-xs leading-relaxed">{path.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* What Implementation May Include */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Implementation May Include</h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mb-3">
            Not every organization needs every component. The implementation plan is built around the partner's actual objectives.
          </p>
          <div className="space-y-1.5">
            {IMPLEMENTATION_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* What We Need to Learn From You */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What We Need to Learn From You</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Before recommending a partnership structure, we need to understand your organization. You do not need to have the complete solution figured out before contacting us — the consultation is designed to help determine the best path.
          </p>
          <div className="space-y-2">
            {NEED_TO_KNOW.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* What Happens After You Apply */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
          transition={{ delay: 0.32 }}
          className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5"
        >
          <h3 className="text-orange-300 font-bold text-base mb-1">Request a Healthcare Partnership Consultation</h3>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Tell us about your practice, healthcare organization, patient population, and the problem you want to solve. Submitting a consultation request is not a commitment and does not guarantee acceptance. It is the beginning of a personal review and discovery conversation with the My Perfect Meals team.
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
            Every request is reviewed personally.
          </p>
        </motion.div>

        {/* Footer link */}
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
