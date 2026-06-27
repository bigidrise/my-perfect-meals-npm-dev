import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Handshake, Pill, Dumbbell, GraduationCap, HeartPulse, Code2, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const STRATEGIC_FORM = "https://forms.gle/7wAMmDA1vz1wCzzKA";

const INDUSTRIES = [
  {
    id: "supplement",
    icon: Pill,
    title: "Supplement & Beverage Brands",
    examples: [],
    help: [
      "Product integration opportunities",
      "Recipe and meal placement",
      "Brand visibility inside meal experiences",
      "Educational content opportunities",
      "Consumer engagement campaigns",
      "Ingredient and nutrition education",
    ],
    paths: [
      { label: "Creator & Brand Studio", route: "/creator-studio", external: false },
    ],
  },
  {
    id: "nutrition",
    icon: Handshake,
    title: "Nutrition Companies",
    examples: [],
    help: [
      "Nutrition delivery infrastructure",
      "Meal planning and personalization",
      "Client engagement tools",
      "Retention and accountability systems",
      "Professional dashboards",
      "Business growth opportunities",
    ],
    paths: [
      { label: "Founding Business Partner", route: "/business-center/founding-partner", external: false },
      { label: "White Label Opportunities", route: "/business-center/white-label", external: false },
    ],
  },
  {
    id: "fitness",
    icon: Dumbbell,
    title: "Fitness Organizations",
    examples: [],
    help: [
      "Nutrition support for members",
      "Coach and trainer resources",
      "Business growth tools",
      "Marketing resources",
      "Certification support",
      "Client retention and engagement",
    ],
    paths: [
      { label: "Founding Business Partner", route: "/business-center/founding-partner", external: false },
    ],
  },
  {
    id: "certification",
    icon: GraduationCap,
    title: "Certification Bodies",
    examples: ["ISSA", "NASM", "NCSF", "ACSM", "PTA Global"],
    help: [
      "Graduate business startup support",
      "Nutrition technology for graduates",
      "Continuing education opportunities",
      "Business growth resources",
      "Certification integration opportunities",
      "Student success initiatives",
    ],
    paths: [
      { label: "Schedule a Strategic Partnership Discussion", route: STRATEGIC_FORM, external: true },
    ],
  },
  {
    id: "healthcare",
    icon: HeartPulse,
    title: "Healthcare & Wellness Organizations",
    examples: ["Functional medicine practices", "Hormone clinics", "Wellness centers", "Concierge medicine", "Health coaching organizations"],
    help: [
      "Nutrition implementation",
      "Patient engagement",
      "Care team collaboration",
      "Protocol support",
      "Professional dashboards",
      "Business scalability",
    ],
    paths: [
      { label: "Founding Business Partner", route: "/business-center/founding-partner", external: false },
      { label: "White Label Opportunities", route: "/business-center/white-label", external: false },
    ],
  },
  {
    id: "software",
    icon: Code2,
    title: "Software & Technology Partners",
    examples: ["Trainerize", "Everfit", "PT Distinction", "Practice Better", "Healthcare technology platforms"],
    help: [
      "Strategic integrations",
      "Shared user value",
      "Workflow enhancement",
      "Referral partnerships",
      "Co-marketing opportunities",
    ],
    paths: [
      { label: "Schedule a Strategic Partnership Discussion", route: STRATEGIC_FORM, external: true },
    ],
  },
];

export default function IndustryPartnerships() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} text-white`}
    >
      {/* Header */}
      <div className={BC_HEADER}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 text-white/60 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Suite
          </button>
        </div>
      </div>

      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto space-y-5">

        {/* Hero — stays on gradient, keep white text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-5 w-5 text-orange-400 flex-shrink-0" />
            <h1 className="text-white font-bold text-lg leading-tight">Industry & Strategic Partnerships</h1>
          </div>
          <p className="text-orange-300 font-semibold text-sm mb-2">How Different Organizations Work With My Perfect Meals</p>
          <p className="text-white/55 text-sm leading-relaxed">
            My Perfect Meals is designed to support a wide range of organizations across health, fitness, nutrition, wellness, education, and technology. Below are examples of how different industries can leverage the platform.
          </p>
        </motion.div>

        {/* Industry cards */}
        {INDUSTRIES.map((industry, idx) => {
          const Icon = industry.icon;
          return (
            <motion.div
              key={industry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5"
            >
              {/* Title */}
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-orange-100 rounded-lg p-1.5">
                  <Icon className="h-4 w-4 text-orange-500" />
                </div>
                <h2 className="text-gray-900 font-semibold text-sm">{industry.title}</h2>
              </div>

              {/* Examples */}
              {industry.examples.length > 0 && (
                <div className="mb-3">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1.5">Examples</p>
                  <div className="flex flex-wrap gap-1.5">
                    {industry.examples.map((ex) => (
                      <span key={ex} className="bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-500 text-xs">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* How We Help */}
              <div className="mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">How We Help</p>
                <div className="space-y-1.5">
                  {industry.help.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-gray-600 text-xs leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typical Partnership Path */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">Typical Partnership Path</p>
                <div className="space-y-2">
                  {industry.paths.map((path) => (
                    path.external ? (
                      <a
                        key={path.label}
                        href={path.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 w-full text-left"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-orange-600 text-xs font-semibold">{path.label}</span>
                      </a>
                    ) : (
                      <button
                        key={path.label}
                        onClick={() => setLocation(path.route)}
                        className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 w-full text-left"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-gray-700 text-xs font-semibold">{path.label}</span>
                      </button>
                    )
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Not Sure Where You Fit */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-orange-50 border border-orange-200 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <h2 className="text-gray-900 font-semibold text-sm">Not Sure Where You Fit?</h2>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            Every organization is different. If you're unsure which pathway best fits your business, schedule a Strategic Partnership Discussion and we'll help determine the best approach.
          </p>
          <a
            href={STRATEGIC_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-orange-600 rounded-xl px-4 py-3 w-full"
          >
            <span className="text-white font-bold text-sm">Schedule a Strategic Partnership Discussion</span>
            <ChevronRight className="h-4 w-4 text-white" />
          </a>
        </motion.div>

      </div>
    </motion.div>
  );
}
