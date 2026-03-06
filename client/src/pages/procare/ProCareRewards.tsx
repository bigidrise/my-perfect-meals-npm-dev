import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Trophy, TrendingUp, Star, Users, Flame } from "lucide-react";

const TIERS = [
  {
    name: "Bronze Coach",
    earnings: "25%",
    icon: <Trophy className="w-6 h-6" />,
    color: "text-amber-600",
    borderColor: "border-amber-600/30",
    bgColor: "bg-amber-900/10",
    description: "Standard referral code earnings for coaches beginning on the platform.",
    requirements: null,
  },
  {
    name: "Silver Coach",
    earnings: "27.5%",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "text-slate-300",
    borderColor: "border-slate-300/30",
    bgColor: "bg-slate-700/10",
    description: "Elevated earnings for coaches building momentum.",
    requirements: [
      "Positive client ratings",
      "Active client engagement",
      "Platform participation",
    ],
  },
  {
    name: "Gold Coach",
    earnings: "30%",
    icon: <Star className="w-6 h-6" />,
    color: "text-yellow-400",
    borderColor: "border-yellow-400/30",
    bgColor: "bg-yellow-900/10",
    description: "Top-tier earnings for elite coaches.",
    requirements: [
      "High client satisfaction",
      "Consistent client retention",
      "Strong platform contribution",
    ],
  },
];

const FOUNDERS = [
  { name: "Coach Idrise", title: "Founder & Lead Coach" },
  { name: "Dr. Lindsey Prescher MD", title: "Medical Compliance Advisor" },
  { name: "Kristen Bogan", title: "Founding Coach" },
];

export default function ProCareRewards() {
  const [, setLocation] = useLocation();

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

            <h1 className="text-2xl font-bold mb-2">Top Coaches Earn More</h1>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-full border border-orange-400/20 mb-3">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300">Coaches who help clients succeed earn more on My Perfect Meals</span>
            </div>

            <p className="text-white/60 text-sm max-w-sm mx-auto">
              My Perfect Meals rewards coaches who build strong client relationships and deliver real results.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`p-5 rounded-xl border ${tier.borderColor} ${tier.bgColor}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={tier.color}>{tier.icon}</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                </div>
                <div className={`text-xl font-bold ${tier.color}`}>{tier.earnings}</div>
              </div>
              <p className="text-sm text-white/60 mb-2">{tier.description}</p>
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

        <div className="mb-8 p-5 rounded-xl border border-blue-400/20 bg-blue-900/10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-blue-400">Founding Coaches</h2>
          </div>
          <p className="text-sm text-white/60 mb-4">
            These founding coaches helped shape the platform from day one.
          </p>
          <div className="space-y-3">
            {FOUNDERS.map((founder) => (
              <div key={founder.name} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {founder.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{founder.name}</p>
                  <p className="text-xs text-white/50">{founder.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-400/10">
          <h3 className="text-sm font-semibold mb-2">Coaching System</h3>
          <p className="text-xs text-white/50">
            My Perfect Meals uses a macro-based nutrition framework. Coaches maintain their own style, but the platform structure is macro-driven.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/procare-philosophy")}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Continue to Coaching Profile
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
