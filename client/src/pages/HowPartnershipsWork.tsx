import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  Tag,
  Link2,
  QrCode,
  DollarSign,
  Users,
  Package,
  Layers,
  Megaphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const STRATEGIC_FORM = "https://forms.gle/Udi3yWGp5SHuktdi8";

const PARTNER_TYPES = [
  {
    id: "referral",
    icon: Megaphone,
    title: "Referral Partner",
    tagline: "You promote. You earn.",
    who: "Media companies, influencers, coaches, podcast hosts, magazine publishers, and community leaders.",
    examples: ["Magazine publisher — fitness & wellness media", "Podcast hosts", "Health influencers"],
    gets: [
      "Personalized promo code (e.g. FITPRO or WELLNESSCO)",
      "Tracked referral link",
      "Downloadable QR code",
      "Customer discount to offer your audience",
      "Recurring commission on every subscriber you refer",
      "Marketing resources and suggested language",
    ],
    doesNotGet: ["Seats or team management", "Product placement"],
    accent: "border-orange-500/30 bg-orange-500/10",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/20",
  },
  {
    id: "organization",
    icon: Users,
    title: "Organization Partner",
    tagline: "You run a team. We power the platform.",
    who: "Gyms, training companies, coaching organizations, fitness studios, and wellness businesses.",
    examples: ["Coaching organization", "Fitness studio", "Gyms and training companies"],
    gets: [
      "Organization Dashboard",
      "Team seat management",
      "Coach and staff management",
      "Academy certification program",
      "Personalized promo code",
      "Referral link and QR code",
      "Commission on referred subscribers",
      "Marketing resources",
    ],
    doesNotGet: ["Clinical or product placement (unless added)"],
    accent: "border-white/15 bg-white/5",
    iconColor: "text-orange-400",
    iconBg: "bg-white/10",
  },
  {
    id: "product",
    icon: Package,
    title: "Product Partner",
    tagline: "Your product meets our platform.",
    who: "Supplement brands, beverage companies, food brands, and nutrition product manufacturers.",
    examples: ["Supplement brand partner", "Beverage companies"],
    gets: [
      "Product and ingredient integration",
      "Brand and product placement inside meal experiences",
      "Ingredient intelligence and recipe features",
      "Educational content opportunities",
      "Personalized promo code",
      "Referral link and QR code",
      "Commission on referred subscribers",
      "Co-marketing opportunities",
    ],
    doesNotGet: ["Team seat management (unless added)"],
    accent: "border-white/15 bg-white/5",
    iconColor: "text-orange-400",
    iconBg: "bg-white/10",
  },
  {
    id: "hybrid",
    icon: Layers,
    title: "Hybrid Partner",
    tagline: "Everything that applies to your business.",
    who: "Clinical practices, functional medicine clinics, and organizations that operate a team, carry products, and refer customers.",
    examples: ["Clinical organization + supplement partner + referral"],
    gets: [
      "Organization Dashboard and team seats",
      "Clinical workflow support",
      "Product and supplement integration",
      "Personalized promo code",
      "Referral link, QR code, and marketing resources",
      "Commission on referred subscribers",
      "All applicable capabilities based on your relationship",
    ],
    doesNotGet: [],
    accent: "border-white/15 bg-white/5",
    iconColor: "text-orange-400",
    iconBg: "bg-white/10",
  },
];

const HOW_IT_WORKS_ITEMS = [
  {
    icon: Tag,
    title: "Promo Code",
    description:
      "Every approved partner receives a personalized promo code — like FITPRO or WELLNESSCO. When a customer enters that code at checkout, they receive a discount. The code is short, memorable, and works in any format: on air, in print, in video, in conversation.",
  },
  {
    icon: Link2,
    title: "Referral Link",
    description:
      "Your unique referral link tracks every visitor who clicks through to My Perfect Meals. If they subscribe, you receive credit automatically through our attribution system. Use it anywhere online.",
  },
  {
    icon: QrCode,
    title: "QR Code",
    description:
      "A downloadable QR code tied to your referral link. Print it on business cards, clinic handouts, gym flyers, or presentation slides. Anyone who scans it is tracked back to you.",
  },
  {
    icon: DollarSign,
    title: "Customer Discount vs. Partner Commission",
    description:
      "These are two separate things. The customer discount is what your audience saves when they use your code — for example, 10% or 15% off their subscription. Your commission is what you earn when someone subscribes through your link or code. They are negotiated separately and do not come from the same pool.",
  },
];

export default function HowPartnershipsWork() {
  const [location, setLocation] = useLocation();
  const isPublic = location.startsWith("/partners");
  const backPath = isPublic ? "/partners" : "/business-center/partners";
  const backLabel = "Partner Programs";

  useEffect(() => {
    document.title = "How Partnerships Work | My Perfect Meals";
    return () => { document.title = "My Perfect Meals"; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
    >
      <div className={BC_HEADER} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation(backPath)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <h1 className="text-base font-bold text-white">How Partnerships Work</h1>
        </div>
      </div>

      <div
        className="pb-24 px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <button
          onClick={() => setLocation(backPath)}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
          <h1 className="text-white font-bold text-xl leading-tight mb-2">How Partnerships Work</h1>
          <p className="text-orange-400 font-semibold text-sm mb-3">
            Every partnership is built around your business — not ours.
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Some partners promote the platform to their audience. Some run organizations on it. Some integrate products into it. Some do all three. There is no single partnership model — we build the relationship around what you actually do.
          </p>
        </motion.div>

        {/* How the mechanics work */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-4">
            The Mechanics
          </p>
          <div className="space-y-4">
            {HOW_IT_WORKS_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Four partnership types */}
        <div>
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3 px-1">
            Four Ways to Partner With My Perfect Meals
          </p>
          <div className="space-y-3">
            {PARTNER_TYPES.map((type, idx) => {
              const Icon = type.icon;
              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + idx * 0.05 }}
                  className={`border rounded-2xl p-5 ${type.accent}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${type.iconBg}`}>
                      <Icon className={`h-4 w-4 ${type.iconColor}`} />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-sm leading-tight">{type.title}</h2>
                      <p className="text-orange-400 text-xs font-medium mt-0.5">{type.tagline}</p>
                    </div>
                  </div>

                  <p className="text-gray-400 text-xs leading-relaxed mb-3">{type.who}</p>

                  {type.examples.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {type.examples.map((ex) => (
                        <span
                          key={ex}
                          className="bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 text-gray-400 text-[11px]"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    What this partner receives
                  </p>
                  <div className="space-y-1.5">
                    {type.gets.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                        <span className="text-gray-300 text-xs leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* One partner, multiple roles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">
            One Partner, Multiple Roles
          </p>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            A partner can hold more than one role simultaneously. A clinical organization that carries supplement products and refers customers is an Organization Partner, a Product Partner, and a Referral Partner at the same time.
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            A coaching organization that earns referral commissions is both an Organization Partner and a Referral Partner. Your Partner & Revenue Center reflects exactly your relationship — nothing more, nothing less.
          </p>
        </motion.div>

        {/* Discount policy */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
        >
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">
            Standard Discount Policy
          </p>
          <div className="space-y-3">
            {[
              { label: "Standard partner discount", value: "10% off for referred customers" },
              { label: "Strategic promotional discount", value: "15% off — approved case by case" },
              { label: "Larger or time-limited discounts", value: "Require direct approval" },
              { label: "Commission rate", value: "Negotiated separately per partnership" },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-white/8 last:border-0">
                <span className="text-xs text-gray-400 leading-relaxed">{row.label}</span>
                <span className="text-xs font-semibold text-orange-400 text-right flex-shrink-0">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
            Discounts and commissions are separate. The discount your audience receives does not reduce your commission rate.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5"
        >
          <h2 className="text-white font-bold text-sm mb-2">Ready to get started?</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            If you're not sure which partnership type fits your situation, or you want to discuss a custom arrangement, schedule a Strategic Partnership Discussion and we'll work it out together.
          </p>
          <a
            href={STRATEGIC_FORM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-orange-600 rounded-xl px-4 py-3 w-full"
          >
            <span className="text-white font-bold text-sm">Schedule a Discussion</span>
            <ChevronRight className="h-4 w-4 text-white" />
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
