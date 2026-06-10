import { useLocation } from "wouter";
import { ArrowLeft, Star, Users, CheckCircle2, TrendingUp, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const FOUNDING_PARTNER_FORM = "https://forms.gle/7wAMmDA1vz1wCzzKA";

const WHO_FOR = [
  "Health Coaching Practices",
  "Nutrition Coaching Practices",
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
  { label: "Founding Business Partner recognition", sub: "Permanently recognized as a program founder" },
  { label: "Reduced Founding Business Partner pricing", sub: "Locked-in rates that reflect your early commitment" },
];

const EXPECTATIONS = [
  "Active platform usage with real members or clients",
  "Ongoing feedback through structured check-ins",
  "Participation in feature testing before public release",
  "Participation in onboarding refinement",
  "Willingness to share implementation feedback, workflow insights, and outcomes",
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
          <h1 className="text-lg font-bold text-white">Founding Business Partner Program</h1>
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
            The Founding Business Partner Program is open to a very small number of organizations, practices, clinics, and businesses. Founding Business Partners work directly with the MPM team to validate, refine, and improve the platform through real-world implementation.
          </p>
        </motion.div>

        {/* Section 0 — How Organizations Participate */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">How Organizations Participate</h3>
          </div>
          <p className="text-white/60 text-sm leading-relaxed mb-4">
            There are two tracks inside this program: <span className="text-orange-300 font-medium">Founding Affiliate Partner</span> and <span className="text-white/70 font-medium">Founding Business Partner</span>. Both involve direct collaboration with the MPM team. The key difference is the workload — and therefore the investment.
          </p>

          {/* Path 1 */}
          <div className="bg-orange-600/10 border border-orange-500/20 rounded-xl p-4 mb-3">
            <div className="text-orange-300 text-xs font-bold uppercase tracking-wider mb-2">Founding Affiliate Partner</div>
            <p className="text-white/65 text-sm leading-relaxed mb-3">
              Designed for coaches, educators, practitioners, influencers, and businesses that want to incorporate My Perfect Meals directly into their existing services. You continue operating under your own brand while offering your clients access to the MPM platform.
            </p>
            <p className="text-white/45 text-xs leading-relaxed mb-2">Partners in this pathway receive</p>
            <div className="space-y-1">
              {[
                "Dedicated onboarding and implementation support",
                "Business Success & Platform Certification",
                "Marketing materials and positioning guidance",
                "Launch planning and communication support",
                "Affiliate tools, product codes, and commission structure",
                "Direct collaboration and strategic guidance",
                "Early feature access and direct feedback channel",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60 flex-shrink-0" />
                  <span className="text-white/55 text-xs">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Coaches", "Educators", "Influencers", "Health Professionals", "Membership Communities"].map((t, i) => (
                <span key={i} className="text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-300/70 rounded-full px-2.5 py-0.5">{t}</span>
              ))}
            </div>
          </div>

          {/* Path 2 */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2">Founding Business Partner</div>
            <p className="text-white/65 text-sm leading-relaxed mb-3">
              Designed for organizations that want a branded experience powered by My Perfect Meals. White Label Partners operate under their own business identity while MPM provides the platform, implementation support, team training, and launch infrastructure.
            </p>
            <p className="text-white/45 text-xs leading-relaxed mb-2">Partners in this pathway receive</p>
            <div className="space-y-1">
              {[
                "Full brand configuration and setup",
                "Team onboarding and provider training",
                "Implementation and workflow planning",
                "Launch support and marketing alignment",
                "Brand integration and compliance guidance",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
                  <span className="text-white/55 text-xs">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Clinics", "Practices", "Wellness Organizations", "Healthcare Companies", "Multi-Provider Businesses"].map((t, i) => (
                <span key={i} className="text-[10px] bg-white/5 border border-white/10 text-white/40 rounded-full px-2.5 py-0.5">{t}</span>
              ))}
            </div>
          </div>
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
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Is a Founding Business Partner?</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed">
            Founding Business Partners are organizations, practices, clinics, and teams implementing My Perfect Meals with real members, patients, or clients. In exchange for early access and reduced pricing, Founding Business Partners participate in refining the platform — sharing workflow feedback, client outcomes, retention data, and candid insights that help the product improve faster than it could in isolation.
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

        {/* Section 1b — Why We Created This Program */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Why We Created This Program</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed mb-3">
            My Perfect Meals has reached the stage where real-world implementation and feedback are more valuable than theoretical planning.
          </p>
          <p className="text-white/65 text-sm leading-relaxed mb-4">
            While the platform is mature enough for organizations to begin using it today, we believe the best way to continue improving the product is by partnering with real businesses serving real clients, patients, and members.
          </p>
          <p className="text-white/45 text-xs uppercase tracking-wider font-semibold mb-2">The Founding Business Partner Program was created to help us</p>
          <div className="space-y-1.5 mb-4">
            {[
              "Validate real-world workflows",
              "Gather provider and client feedback",
              "Improve onboarding experiences",
              "Refine business and coaching tools",
              "Identify opportunities for future development",
              "Build case studies and success stories",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 pt-4 space-y-2">
            <p className="text-white/70 text-sm leading-relaxed font-medium">
              Founding Business Partners are not simply customers.
            </p>
            <p className="text-white/55 text-sm leading-relaxed">
              They are early collaborators helping shape the future of the platform. In return for their participation, feedback, and partnership, Founding Business Partners receive reduced implementation costs, reduced monthly pricing, priority support, and direct access to the My Perfect Meals team.
            </p>
            <p className="text-white/45 text-sm leading-relaxed">
              This program is intentionally limited and is designed for organizations and businesses that want to grow alongside the platform while helping us make it even better.
            </p>
          </div>
        </motion.div>

        {/* Section 2 — Ideal Founding Partners */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Ideal Founding Business Partners</h3>
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
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Founding Business Partner Benefits</h3>
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

        {/* Section 3b — What Implementation Includes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Implementation Includes</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed mb-3">
            A Founding Business Partner deployment involves far more than access to software. Our goal is to help organizations successfully implement My Perfect Meals into their business, coaching, wellness, or healthcare workflows.
          </p>
          <p className="text-white/45 text-xs uppercase tracking-wider font-semibold mb-2">Depending on the organization, implementation may include</p>
          <div className="space-y-1.5 mb-4">
            {[
              "Discovery and planning sessions",
              "Business workflow discussions",
              "Provider onboarding",
              "Team onboarding",
              "Platform certification",
              "Business Success Certification",
              "Team training sessions",
              "Launch preparation",
              "Initial implementation support",
              "Workflow refinement and feedback reviews",
              "Ongoing collaboration during the launch period",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 pt-3">
            <p className="text-white/45 text-xs leading-relaxed">
              Every organization is different, and implementation requirements vary based on team size, services offered, and desired outcomes. The Founding Business Partner Program is designed to provide direct support throughout the onboarding and implementation process so organizations can begin using the platform effectively and confidently.
            </p>
          </div>
        </motion.div>

        {/* Section 4 — Expectations */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
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

        {/* Section 4b — What Happens After Acceptance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">What Happens After Acceptance?</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed mb-4">
            Once accepted into the Founding Business Partner Program, organizations enter an implementation and onboarding process designed to prepare their team for a successful launch.
          </p>
          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">A typical implementation may include</p>

          <div className="space-y-4">
            {[
              {
                phase: "Phase 1 — Discovery & Planning",
                items: ["Business goals review", "Workflow discussions", "Service model review", "Team structure review", "Launch planning"],
              },
              {
                phase: "Phase 2 — Platform Configuration",
                items: ["Account configuration", "Provider access setup", "Team access setup", "Initial platform configuration", "Pathway-specific setup (branding or standard)"],
              },
              {
                phase: "Phase 3 — Team Training",
                items: ["Leadership training", "Coach / provider training", "Platform certification", "Business Success Certification", "Workflow training", "Q&A sessions"],
              },
              {
                phase: "Phase 4 — Launch Support",
                items: ["Launch preparation", "Early implementation support", "Workflow refinement", "Feedback collection", "Follow-up sessions"],
              },
            ].map((block, i) => (
              <div key={i} className="bg-black/30 border border-white/8 rounded-xl p-3">
                <div className="text-orange-300 text-xs font-semibold mb-2">{block.phase}</div>
                <div className="space-y-1">
                  {block.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
                      <span className="text-white/55 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-white/8 pt-4 space-y-2">
            <p className="text-white/70 text-sm font-medium leading-snug">
              Founding Business Partner pricing reflects a collaborative implementation process, not simply access to software.
            </p>
            <p className="text-white/50 text-xs leading-relaxed">
              The setup investment helps support the time, planning, onboarding, training, configuration, and launch support required to help organizations successfully deploy the platform.
            </p>
            <p className="text-white/50 text-xs leading-relaxed">
              Our objective is to help organizations implement a solution that creates value for their clients, patients, members, and business operations. This is why Founding Business Partner pricing remains significantly reduced from future standard deployment pricing while still reflecting the real work required to support a successful launch.
            </p>
          </div>
        </motion.div>

        {/* Section 4c — Brand & Marketing Alignment */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Brand & Marketing Alignment</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed mb-4">
            Successful implementation involves more than technology and training. Organizations must also understand how My Perfect Meals is positioned, communicated, and marketed.
          </p>

          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">As part of implementation, organizations may receive</p>
          <div className="space-y-1.5 mb-4">
            {[
              "Marketing guidance",
              "Approved messaging frameworks",
              "Positioning recommendations",
              "Brand alignment support",
              "Launch communication guidance",
              "Educational content recommendations",
              "Marketing resource access",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-white/8 pt-4">
            <div>
              <p className="text-white/70 text-sm font-medium leading-snug mb-1">My Perfect Meals is not marketed as a weight-loss product.</p>
              <p className="text-white/50 text-xs leading-relaxed">
                The platform is not marketed as a medical treatment, cure, or guaranteed outcome system. Organizations are expected to market their programs responsibly and in alignment with platform guidelines — this protects your members and your professional standing.
              </p>
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium leading-snug mb-1">Brand standards apply when the platform is represented publicly.</p>
              <p className="text-white/50 text-xs leading-relaxed">
                While organizations maintain full ownership of their brand and customer relationships, My Perfect Meals reserves the right to require compliance with platform branding, marketing, and communication standards when the platform is being represented publicly.
              </p>
            </div>
            <div className="bg-orange-600/8 border border-orange-500/15 rounded-xl p-3">
              <p className="text-orange-300/80 text-xs leading-relaxed">
                The objective is to protect consumers, maintain brand integrity, and ensure consistent messaging across all organizations using the platform — for the benefit of every partner and every member.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section 4d — Why Founding Partners Pay */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-black/50 border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Why Founding Partners Pay</h3>
          </div>
          <p className="text-white/65 text-sm leading-relaxed mb-3">
            Founding Business Partners are not purchasing software access.
          </p>
          <p className="text-white/60 text-sm leading-relaxed mb-3">
            The investment reflects the direct, personal work involved in helping your organization implement, train, launch, market, and integrate My Perfect Meals into your business — not just unlocking a platform.
          </p>
          <p className="text-white/45 text-xs uppercase tracking-wider font-semibold mb-2">What the investment covers</p>
          <div className="space-y-1.5 mb-4">
            {[
              "Direct, personalized implementation support",
              "Hands-on onboarding and launch planning",
              "Team training and certification guidance",
              "Marketing alignment and communication strategy",
              "Strategic collaboration during your launch period",
              "Ongoing feedback sessions and workflow refinement",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
          <div className="bg-orange-600/8 border border-orange-500/15 rounded-xl p-3">
            <p className="text-orange-300/80 text-xs leading-relaxed">
              Founding Business Partners are early collaborators. The reduced pricing reflects that relationship — and what both sides are committing to.
            </p>
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

          <p className="text-white/55 text-sm leading-relaxed mb-4">
            Pricing reflects the actual work involved — not access to software. Each track has different investment levels because the workload is fundamentally different.
          </p>

          {/* Founding Affiliate Partner card */}
          <div className="bg-orange-600/10 border border-orange-500/20 rounded-xl p-4 mb-3">
            <div className="text-orange-300 text-xs font-bold uppercase tracking-wider mb-3">Founding Affiliate Partner</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-white font-black text-2xl">$197</span>
              <span className="text-white/40 text-sm">/ month</span>
            </div>
            <div className="text-orange-400/60 text-xs font-semibold mb-3">No setup fee</div>
            <p className="text-white/45 text-xs leading-relaxed mb-3">
              For coaches, creators, and practitioners collaborating directly with the MPM team. You're not deploying a system — you're building a partnership.
            </p>
            <div className="space-y-1">
              {[
                "Monthly founder call",
                "Direct access channel",
                "Early feature access & roadmap input",
                "Business Success & Platform Certification",
                "Marketing resources & review",
                "Enhanced affiliate commissions",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60 flex-shrink-0" />
                  <span className="text-white/55 text-xs">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Founding Business Partner card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Founding Business Partner</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-white/30 text-xs mb-0.5">Setup Investment</div>
                <div className="text-white font-black text-lg">$1,500 – $3,000</div>
                <div className="text-white/30 text-xs">one-time</div>
              </div>
              <div>
                <div className="text-white/30 text-xs mb-0.5">Monthly</div>
                <div className="text-white font-black text-lg">$297 – $997</div>
                <div className="text-white/30 text-xs">per month</div>
              </div>
            </div>
            <p className="text-white/45 text-xs leading-relaxed mb-3">
              For practices, clinics, and organizations requiring real deployment work — team onboarding, workflow configuration, staff training, and launch support.
            </p>
            <p className="text-white/30 text-xs leading-relaxed">
              Final pricing depends on team size, number of providers, implementation complexity, and selected pathway (Powered by MPM or White Label).
            </p>
          </div>

          <p className="text-white/25 text-xs leading-relaxed mt-3 border-t border-white/5 pt-3">
            Both tracks reflect meaningful discounts from standard rates in recognition of early commitment, feedback participation, and the collaborative nature of this program.
          </p>
        </motion.div>

        {/* Section 6 — CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-orange-600/10 border border-orange-500/20 rounded-2xl p-5"
        >
          <h3 className="text-orange-300 font-bold text-sm mb-1">Apply for Founding Business Partner Consideration</h3>
          <p className="text-white/55 text-xs leading-relaxed mb-4">
            This program is intentionally limited to organizations, practices, clinics, and businesses ready for real implementation. Applications are reviewed personally by the MPM team. Submitting a request is not a commitment — it's the start of a conversation.
          </p>

          <a
            href={FOUNDING_PARTNER_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-orange-600 text-white rounded-xl px-4 py-3.5 font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <span>Request Founding Business Partner Consultation</span>
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
