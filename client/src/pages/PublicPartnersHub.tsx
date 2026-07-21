import { useLocation } from "wouter";
import { Star, Handshake, Stethoscope, Building2, ChevronRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

const CONSULTATION_FORM = "https://forms.gle/7wAMmDA1vz1wCzzKA";

const programs = [
  {
    id: "founding",
    title: "Founding Partner Program",
    description:
      "For established influencers, experts, supplement brands, coaches, and organizations bringing audience, products, protocols, or strategic value to My Perfect Meals.",
    icon: Star,
    route: "/partners/founding",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/30",
    tags: ["Influencers", "Supplement Brands", "Coaches", "Experts", "Organizations"],
  },
  {
    id: "industry",
    title: "Industry & Strategic Partnerships",
    description:
      "For wellness organizations, fitness brands, certification bodies, and industry leaders exploring platform partnerships at scale.",
    icon: Handshake,
    route: "/partners/industry",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
    tags: ["Fitness Brands", "Certification Bodies", "Technology Partners", "Wellness Organizations"],
  },
  {
    id: "healthcare",
    title: "Healthcare & Clinical Partnerships",
    description:
      "For physicians, registered dietitians, hospitals, clinics, and clinical organizations serving patients through nutrition.",
    icon: Stethoscope,
    route: "/partners/healthcare",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
    tags: ["Physicians", "Dietitians", "Hospitals", "Clinics", "Functional Medicine"],
  },
  {
    id: "white-label",
    title: "White Label Solutions",
    description:
      "License the My Perfect Meals platform to deliver a fully branded nutrition product under your own identity.",
    icon: Building2,
    route: "/partners/white-label",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
    tags: ["Gym Chains", "Corporate Wellness", "Healthcare Systems", "Enterprise"],
  },
];

export default function PublicPartnersHub() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black pb-16">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
            My Perfect Meals
          </p>
          <h1 className="text-3xl font-black text-white leading-tight mb-3">
            Partner Programs
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed max-w-sm mx-auto">
            My Perfect Meals is building relationships with a limited number of established experts, brands, and organizations. Select the partnership type that best describes your opportunity.
          </p>
        </motion.div>
      </div>

      {/* Program cards */}
      <div className="px-4 max-w-2xl mx-auto space-y-3">
        {programs.map((program, i) => {
          const Icon = program.icon;
          return (
            <motion.button
              key={program.id}
              className={`w-full text-left p-5 rounded-2xl bg-black/60 border ${program.border} active:scale-[0.98] transition-all duration-200`}
              onClick={() => setLocation(program.route)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${program.accent} flex-shrink-0 mt-0.5`}>
                  <Icon className={`h-5 w-5 ${program.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white leading-snug mb-1">
                    {program.title}
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-2.5">
                    {program.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {program.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-white/8 border border-white/10 text-gray-400 rounded-full px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0 mt-1" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Not sure section */}
      <motion.div
        className="px-4 max-w-2xl mx-auto mt-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 text-center">
          <p className="text-white text-sm font-semibold mb-1">Not sure which fits you?</p>
          <p className="text-gray-400 text-xs leading-relaxed mb-4">
            Submit a consultation request and we'll help determine the best partnership path during our conversation.
          </p>
          <a
            href={CONSULTATION_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-600 text-white rounded-xl px-5 py-3 font-semibold text-sm active:scale-[0.97] transition-transform"
          >
            <span>Request a Partnership Consultation</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="text-gray-500 text-xs mt-3">
            Not a commitment. Every request is reviewed personally.
          </p>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="px-4 max-w-2xl mx-auto mt-8 text-center">
        <p className="text-white/20 text-xs">
          My Perfect Meals — AI-powered nutrition platform
        </p>
        <a
          href="https://app.myperfectmeals.ai"
          className="text-orange-400/50 text-xs underline underline-offset-2 mt-1 block"
        >
          Already a member? Sign in
        </a>
      </div>
    </div>
  );
}
