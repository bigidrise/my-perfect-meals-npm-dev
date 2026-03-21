import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Trophy, TrendingUp, Star, Users, Flame, ChevronDown, X } from "lucide-react";

const TIERS = [
  {
    name: "Bronze Coach",
    earnings: "25%",
    threshold: "0–49 Active Clients",
    icon: <Trophy className="w-6 h-6" />,
    color: "text-amber-600",
    borderColor: "border-amber-600/30",
    bgColor: "bg-amber-900/10",
    description: "Standard referral code earnings for coaches beginning on the platform.",
    requirements: null,
  },
  {
    name: "Silver Coach",
    earnings: "30%",
    threshold: "50+ Active Clients",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "text-slate-300",
    borderColor: "border-slate-300/30",
    bgColor: "bg-slate-700/10",
    description: "Elevated earnings for coaches building momentum.",
    requirements: ["50+ active clients"],
  },
  {
    name: "Gold Coach",
    earnings: "35%",
    threshold: "100+ Active Clients",
    icon: <Star className="w-6 h-6" />,
    color: "text-yellow-400",
    borderColor: "border-yellow-400/30",
    bgColor: "bg-yellow-900/10",
    description: "Top-tier earnings for elite coaches.",
    requirements: ["100+ active clients"],
  },
];

type Founder = {
  name: string;
  title: string;
  subtitle?: string;
  photo?: string;
  initials: string;
  bio: string;
  credentials: string[];
};

const FOUNDERS: Founder[] = [
  {
    name: "Coach Idrise",
    title: "Founder & Lead Coach",
    photo: "/assets/founder-photo.jpg",
    initials: "CI",
    bio: "I've spent over 25 years working in performance nutrition, body composition, and structured meal design. My background combines competitive athletics, clinical awareness, and real-world coaching experience. My Perfect Meals was built to remove confusion, eliminate food stress, and help people eat confidently without restriction.",
    credentials: [
      "NASM Certified Personal Trainer",
      "NASM Certified Nutrition Coach",
      "NASM Behavior Change Specialist",
      "Former IFBB Professional Bodybuilder",
      "Former ICU Medic & EMT-I – U.S. Air Force",
    ],
  },
  {
    name: "Dr. Lindsey Prescher, MD",
    title: "Chief Medical Officer (CMO)",
    subtitle: "Cardiothoracic Surgeon DO FASC FACC Ret. CDR USN MC",
    photo: "/assets/dr-lindsey.jpg",
    initials: "LP",
    bio: "Dr. Lindsey Prescher serves as the Chief Medical Officer of My Perfect Meals, ensuring that every nutritional guideline, guardrail, and clinical pathway on the platform meets the highest standard of medical accuracy and patient safety. Her oversight brings rigorous clinical credibility to everything we build.",
    credentials: [
      "Cardiothoracic Surgeon (Retired)",
      "DO FASC FACC",
      "Commander, United States Navy Medical Corps (Ret.)",
      "Medical Compliance & Regulatory Oversight",
    ],
  },
  {
    name: "Kristen Bogan",
    title: "Founding Coach",
    photo: "/assets/kristen-bogan-2.jpg",
    initials: "KB",
    bio: "As a dedicated personal trainer, I specialize in helping clients build strength, lose weight, and recover safely and effectively from surgery or injury. My approach is rooted in functional and lifestyle-based training—focusing on movements that make everyday life easier, safer, and more enjoyable. With a background in muscle development and corrective exercise, I design programs that improve mobility, stability, and overall body mechanics. I believe fitness should support the way you live, whether that means lifting with confidence, moving without pain, or having the energy to take on your day. Recovery and longevity are at the core of my philosophy—to empower you with the strength, confidence, and resilience you need to thrive in both the gym and everyday life.",
    credentials: [
      "CPT · Corrective Exercise",
      "Strength & Recovery Coaching",
      "Founding Platform Coach",
    ],
  },
];

export default function ProCareRewards() {
  const [, setLocation] = useLocation();
  const [selectedFounder, setSelectedFounder] = useState<Founder | null>(null);
  const [systemExpanded, setSystemExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="pt-6 pb-2">
          <button
            onClick={() => setLocation("/procare-identity")}
            className="flex items-center gap-1 text-white/60 text-sm mb-4 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900/40 to-blue-800/40 rounded-2xl border border-blue-400/30 mb-4">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">ProCare Professional</span>
            </div>

            <h1 className="text-2xl font-bold mb-1">Top Coaches Earn More</h1>
            <p className="text-white/50 text-sm mb-3">The more clients you help succeed, the more you earn.</p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-full border border-orange-400/20 mb-3">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300">Coaches who help clients succeed earn more on My Perfect Meals</span>
            </div>

            <p className="text-white/60 text-sm max-w-sm mx-auto">
              My Perfect Meals rewards coaches who build strong client relationships and deliver real results.
            </p>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="space-y-4 mb-8">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-5 rounded-xl border ${tier.borderColor} ${tier.bgColor}`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={tier.color}>{tier.icon}</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                  <p className={`text-xs ${tier.color} opacity-80`}>{tier.threshold}</p>
                </div>
                <div className={`text-xl font-bold ${tier.color}`}>{tier.earnings}</div>
              </div>
              <p className="text-sm text-white/60 mb-2 mt-2">{tier.description}</p>
              {tier.requirements && (
                <ul className="space-y-1.5 mt-3">
                  {tier.requirements.map((req) => (
                    <li key={req} className="flex items-center gap-2 text-xs text-white/50">
                      <div className={`w-1.5 h-1.5 rounded-full ${tier.color.replace("text-", "bg-")}`} />
                      {req}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Founding Coaches — clickable bio modals */}
        <div className="mb-8 p-5 rounded-xl border border-blue-400/20 bg-blue-900/10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-blue-400">Founding Coaches</h2>
          </div>
          <p className="text-sm text-white/60 mb-4">
            These founding coaches helped shape the platform from day one. Tap to learn more.
          </p>
          <div className="space-y-3">
            {FOUNDERS.map((founder) => (
              <button
                key={founder.name}
                onClick={() => setSelectedFounder(founder)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 active:scale-[0.98] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {founder.photo ? (
                    <img src={founder.photo} alt={founder.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <span>{founder.initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{founder.name}</p>
                  <p className="text-xs text-white/50 truncate">{founder.title}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/30 rotate-[-90deg] flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Coaching System — expandable accordion */}
        <div className="mb-6 rounded-xl border border-blue-400/10 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 overflow-hidden">
          <button
            onClick={() => setSystemExpanded(!systemExpanded)}
            className="w-full flex items-center gap-3 px-4 py-4 active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">Coaching System</h3>
              <p className="text-xs text-white/40 mt-0.5">Tap to learn how we coach</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-white/40 transition-transform duration-200 ${systemExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {systemExpanded && (
            <div className="px-4 pb-5 space-y-3 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">The My Perfect Meals Coaching System</p>
              <p className="text-sm text-white/70 leading-relaxed">
                We don't guess. We don't restrict. We don't eliminate foods people love.
              </p>
              <p className="text-sm text-white/70 leading-relaxed">
                Everything inside My Perfect Meals is built around a macro-based system that adapts to the client — not the other way around. Coaches use structured macro targets, real-world food flexibility, and behavior-driven adjustments to help clients stay consistent without feeling restricted.
              </p>
              <p className="text-sm text-white/70 leading-relaxed">
                This is not a one-size-fits-all plan. It's a system designed to meet people where they are and guide them toward long-term results.
              </p>
              <p className="text-sm text-white/70 leading-relaxed">
                If you already coach using macros, you'll fit right in. If you don't, the platform helps guide you.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/procare-attestation")}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Continue to Coaching Profile
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Founder Bio Modal */}
      {selectedFounder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedFounder(null)}
        >
          <div
            className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

            {/* Close */}
            <button
              onClick={() => setSelectedFounder(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-[0.98]"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>

            {/* Photo + Name */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg font-bold">
                {selectedFounder.photo ? (
                  <img src={selectedFounder.photo} alt={selectedFounder.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <span>{selectedFounder.initials}</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{selectedFounder.name}</h2>
                <p className="text-sm text-blue-400 font-medium">{selectedFounder.title}</p>
                {selectedFounder.subtitle && (
                  <p className="text-xs text-white/50 mt-0.5">{selectedFounder.subtitle}</p>
                )}
              </div>
            </div>

            {/* Bio */}
            <p className="text-sm text-white/75 leading-relaxed mb-5">{selectedFounder.bio}</p>

            {/* Credentials */}
            {selectedFounder.credentials.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Background</p>
                <ul className="space-y-2">
                  {selectedFounder.credentials.map((cred) => (
                    <li key={cred} className="flex items-start gap-2 text-sm text-white/65">
                      <span className="text-blue-400 mt-0.5">✓</span>
                      {cred}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
