// client/src/pages/kitchen/SignatureKitchenHubPage.tsx
// The Signature Kitchen Network hub — chef discovery AND partner acquisition surface.
// Route: /kitchens
// Audiences: (1) app users browsing kitchens, (2) chefs considering partnership.
//
// CTA architecture:
//   Browse Kitchens      → smooth-scrolls to #kitchen-directory
//   Inside the Kitchen Network → opens ChefCoPilotWalkthrough
//   Apply to Partner / Apply Now → opens KitchenPartnerIntakeModal (5-step intake)
//   Book a Discovery Call → opens Calendly in new tab (CALENDLY_URL constant)
//   Contact Partnerships → opens ContactPartnershipsModal

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ChefHat, Sparkles, Wand2, BookOpen, ShieldCheck, TrendingUp,
  ArrowLeft, ArrowRight, Globe, Layers, Star, CalendarDays, MessageSquare,
  Lock,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import ChefCoPilotWalkthrough from "@/components/kitchen/ChefCoPilotWalkthrough";
import KitchenPartnerIntakeModal from "@/components/kitchen/KitchenPartnerIntakeModal";
import ContactPartnershipsModal from "@/components/kitchen/ContactPartnershipsModal";

// ── Calendly ─────────────────────────────────────────────────────────────────
// Replace with your dedicated partnerships Calendly link when ready.
const CALENDLY_URL = "https://calendly.com/myperfectmeals/signature-kitchen-discovery";

const DISMISS_KEY = "mpm.dismiss.chefCoPilotWalkthrough";

type Kitchen = {
  slug: string;
  displayName: string;
  bio: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  cuisineTypes: string[];
  flavorProfiles: string[];
  primaryColor: string | null;
};

// ── Founding Kitchens teaser data (shown when no live kitchens exist) ─────────
const FOUNDING_KITCHENS = [
  {
    name: "Chef Nolan's Kitchen",
    tags: "Southern · Tex-Mex · Performance Comfort Food",
    color: "#ea580c",
  },
  {
    name: "The Wellness Table",
    tags: "Anti-Inflammatory · Plant-Forward · Clinical Nutrition",
    color: "#10b981",
  },
  {
    name: "Athlete's Edge Kitchen",
    tags: "High-Protein · Performance · Sport Recovery",
    color: "#3b82f6",
  },
];

function HowItWorksStep({
  number, icon: Icon, title, body, color,
}: { number: string; icon: React.ElementType; title: string; body: string; color: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="h-4.5 w-4.5" style={{ color }} />
      </div>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: `${color}88` }}>
            {number}
          </span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function KitchenCard({ kitchen, onNavigate }: { kitchen: Kitchen; onNavigate: () => void }) {
  const primary = kitchen.primaryColor ?? "#ea580c";
  return (
    <div
      className="rounded-2xl overflow-hidden flex-shrink-0 w-64 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ background: `linear-gradient(135deg, ${primary}12 0%, #0a0a0a 100%)`, border: `1px solid ${primary}25` }}
      onClick={onNavigate}
    >
      {kitchen.heroImageUrl ? (
        <div className="relative h-36 overflow-hidden">
          <img src={kitchen.heroImageUrl} alt={kitchen.displayName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
          {kitchen.isFeatured && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/40">
              <Star className="h-2.5 w-2.5 text-amber-300" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-200">Featured</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-28 flex items-center justify-center" style={{ background: `${primary}12` }}>
          <ChefHat className="h-9 w-9 opacity-25" style={{ color: primary }} />
        </div>
      )}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center gap-2.5">
          {kitchen.logoUrl ? (
            <img src={kitchen.logoUrl} alt="" className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
              style={{ border: `1.5px solid ${primary}50` }} />
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${primary}20`, border: `1.5px solid ${primary}40` }}>
              <ChefHat className="h-4 w-4" style={{ color: primary }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{kitchen.displayName}</p>
            {kitchen.cuisineTypes.length > 0 && (
              <p className="text-xs mt-0.5 truncate" style={{ color: `${primary}aa` }}>
                {kitchen.cuisineTypes.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>
        {kitchen.bio && (
          <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{kitchen.bio}</p>
        )}
        <div className="flex items-center gap-1 text-xs font-medium pt-0.5" style={{ color: primary }}>
          <span>Explore kitchen</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

function FoundingKitchenCard({ name, tags, color }: { name: string; tags: string; color: string }) {
  return (
    <div className="rounded-2xl overflow-hidden flex-shrink-0 w-64"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, #080808 100%)`, border: `1px solid ${color}20` }}>
      {/* Blurred hero stand-in */}
      <div className="h-28 relative flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}18 0%, #0a0a0a 100%)` }}>
        <ChefHat className="h-10 w-10 opacity-10" style={{ color }} />
        <div className="absolute inset-0 backdrop-blur-sm" />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Lock className="h-2.5 w-2.5" style={{ color }} />
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>Founding Kitchen</span>
        </div>
      </div>
      <div className="p-3.5 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15`, border: `1.5px solid ${color}35` }}>
            <ChefHat className="h-4 w-4" style={{ color, opacity: 0.5 }} />
          </div>
          <div className="min-w-0">
            <p className="text-white/60 font-semibold text-sm leading-tight truncate">{name}</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: `${color}80` }}>{tags}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium pt-0.5 text-white/20">
          <span>Launching soon</span>
        </div>
      </div>
    </div>
  );
}

export default function SignatureKitchenHubPage() {
  const [, setLocation]      = useLocation();
  const [walkthroughOpen, setWalkthroughOpen]   = useState(false);
  const [intakeOpen, setIntakeOpen]             = useState(false);
  const [contactOpen, setContactOpen]           = useState(false);
  const [kitchens, setKitchens]                 = useState<Kitchen[]>([]);
  const [loadingKitchens, setLoadingKitchens]   = useState(true);
  const directoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title = "The Kitchen Network | My Perfect Meals";
    const load = async () => {
      try {
        const res = await fetch(apiUrl("/api/kitchens/featured"), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setKitchens(data.kitchens ?? []);
        }
      } catch { /* non-fatal */ } finally {
        setLoadingKitchens(false);
      }
    };
    load();
  }, []);

  const activeKitchens = kitchens.filter(k => k.isActive);

  function handleBrowseKitchens() {
    directoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleApply() {
    setWalkthroughOpen(false);
    setIntakeOpen(true);
  }

  function handleBook() {
    setWalkthroughOpen(false);
    window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
  }

  function handleContact() {
    setWalkthroughOpen(false);
    setContactOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="min-h-screen bg-black pb-24"
    >
      {/* Back nav */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <button type="button" onClick={() => setLocation("/lifestyle")}
          className="p-2 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white/60 active:scale-95 transition-transform">
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 60% 0%, #7c2d12 0%, #1a0a00 45%, #000 100%)",
          minHeight: 340,
        }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #ea580c18 0%, transparent 70%)", transform: "translate(20%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #ea580c10 0%, transparent 70%)", transform: "translate(-20%, 30%)" }} />

        <div className="relative px-6 pb-10 max-w-xl mx-auto"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 72px)" }}>
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-orange-500/40" />
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-500/70">My Perfect Meals</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-orange-500/40" />
          </div>

          <h1 className="text-3xl font-black text-white leading-[1.1] tracking-tight mb-3">
            The Kitchen<br />
            <span style={{ color: "#ea580c" }}>Network.</span>
          </h1>

          <p className="text-sm text-white/55 leading-relaxed mb-6 max-w-xs">
            Where culinary identity becomes adaptive, searchable, scalable, and personalized — for every user, every time.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setWalkthroughOpen(true)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-transform active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 8px 24px #ea580c30" }}>
              <Sparkles className="h-4 w-4" />
              Inside the Kitchen Network
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleBrowseKitchens}
                className="py-3 rounded-xl text-white/80 font-medium text-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                Browse Kitchens
              </button>
              <button type="button" onClick={handleApply}
                className="py-3 rounded-xl font-medium text-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#ea580c18", border: "1px solid #ea580c35", color: "#ea580c" }}>
                Apply to Partner
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">

        {/* ── HOW IT WORKS ── */}
        <div className="rounded-2xl p-5 space-y-5"
          style={{ background: "linear-gradient(135deg, #ea580c0d 0%, #0a0a0a 100%)", border: "1px solid #ea580c20" }}>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">How Signature Kitchens Work</h2>
          </div>
          <div className="space-y-5">
            <HowItWorksStep number="01" icon={BookOpen} title="Your Culinary Library"
              body="Real dishes, sauces, techniques, and recipes form the foundation of your kitchen's identity." color="#ea580c" />
            <HowItWorksStep number="02" icon={Wand2} title="Adaptive Culinary Intelligence"
              body="The platform extends your style — generating personalized meals for every user in your kitchen's voice." color="#f97316" />
            <HowItWorksStep number="03" icon={ShieldCheck} title="Wellness Guardrails"
              body="Your style shapes the experience. The platform handles each user's health protocols, dietary rules, and medical guidelines." color="#10b981" />
            <HowItWorksStep number="04" icon={TrendingUp} title="Your Identity Scales"
              body="Every dish generated in your kitchen carries your fingerprint — reaching users at a scale impossible through content alone." color="#ea580c" />
          </div>
        </div>

        {/* ── KITCHEN DIRECTORY ── */}
        <div id="kitchen-directory" ref={directoryRef} className="space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-400" />
              <h2 className="text-base font-semibold text-white">
                {activeKitchens.length > 0 ? "Active Kitchens" : "Founding Kitchens"}
              </h2>
            </div>
            {activeKitchens.length === 0 && !loadingKitchens && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500/50 px-2 py-1 rounded-full"
                style={{ background: "#ea580c12", border: "1px solid #ea580c25" }}>
                Early Access
              </span>
            )}
          </div>

          {activeKitchens.length === 0 && !loadingKitchens && (
            <p className="text-xs text-white/30 leading-relaxed">
              The first wave of Signature Kitchens currently in development inside The Kitchen Network.
            </p>
          )}

          {loadingKitchens ? (
            <div className="flex gap-3 overflow-hidden">
              {[0, 1].map(i => (
                <div key={i} className="rounded-2xl flex-shrink-0 w-64 h-52 animate-pulse"
                  style={{ background: "#ffffff06", border: "1px solid #ffffff0c" }} />
              ))}
            </div>
          ) : activeKitchens.length > 0 ? (
            <div className="-mx-4 px-4 overflow-x-auto">
              <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                {activeKitchens.map(k => (
                  <KitchenCard key={k.slug} kitchen={k} onNavigate={() => setLocation(`/kitchen/${k.slug}`)} />
                ))}
              </div>
            </div>
          ) : (
            /* Founding Kitchens teaser — never shows an empty grid */
            <div className="-mx-4 px-4 overflow-x-auto">
              <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                {FOUNDING_KITCHENS.map(k => (
                  <FoundingKitchenCard key={k.name} {...k} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/8" />

        {/* ── PARTNERSHIP CTAs ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-400" />
            <h2 className="text-base font-semibold text-white">Open Your Kitchen</h2>
          </div>
          <p className="text-sm text-white/45 leading-relaxed -mt-1">
            We're building a network of the most forward-thinking culinary voices in the world. Three ways to start.
          </p>

          <div className="space-y-3">
            {/* Apply */}
            <div className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg, #ea580c18 0%, #7c2d1210 100%)", border: "1px solid #ea580c35" }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#ea580c22", border: "1px solid #ea580c40" }}>
                  <ChefHat className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Apply for a Signature Kitchen</p>
                  <p className="text-white/45 text-xs mt-0.5 leading-relaxed">
                    Submit your chef identity, brand assets, and content catalog. Our team reviews every application personally.
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleApply}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#ea580c" }}>
                Apply Now
              </button>
            </div>

            {/* Book + Contact side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: "#ffffff06", border: "1px solid #ffffff10" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#ffffff0a", border: "1px solid #ffffff15" }}>
                  <CalendarDays className="h-3.5 w-3.5 text-white/50" />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-semibold leading-tight">Book a Discovery Call</p>
                  <p className="text-white/35 text-xs mt-1 leading-relaxed">Talk with our partnerships team before you commit.</p>
                </div>
                <button type="button" onClick={handleBook}
                  className="w-full py-2.5 rounded-lg text-white/80 font-medium text-xs transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                  Book a Call
                </button>
              </div>

              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: "#ffffff06", border: "1px solid #ffffff10" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#ffffff0a", border: "1px solid #ffffff15" }}>
                  <MessageSquare className="h-3.5 w-3.5 text-white/50" />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-semibold leading-tight">Contact Partnerships</p>
                  <p className="text-white/35 text-xs mt-1 leading-relaxed">Questions? Our team responds within 48 hours.</p>
                </div>
                <button type="button" onClick={handleContact}
                  className="w-full py-2.5 rounded-lg text-white/80 font-medium text-xs transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                  Get in Touch
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/8" />

        {/* ── FUTURE KITCHEN CATEGORIES (teaser) ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">Coming to the Network</p>
          <div className="flex flex-wrap gap-2">
            {["Wellness Kitchen", "Athlete Kitchen", "Clinical Kitchen", "Restaurant Kitchen", "Performance Kitchen"].map(label => (
              <span key={label} className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff12", color: "rgba(255,255,255,0.35)" }}>
                {label}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/25 leading-relaxed pt-1">
            The Signature Kitchen infrastructure supports chef kitchens, wellness professionals, athletes, physicians, and restaurant groups — all under one adaptive platform.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/18 pb-2 leading-relaxed">
          Powered by My Perfect Meals Adaptive Culinary Intelligence<br />
          partnerships@myperfectmeals.com
        </p>
      </div>

      {/* ── Modals / Walkthrough ── */}
      <ChefCoPilotWalkthrough
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        onApply={handleApply}
        onBook={handleBook}
        onContact={handleContact}
      />

      <KitchenPartnerIntakeModal
        isOpen={intakeOpen}
        onClose={() => setIntakeOpen(false)}
      />

      <ContactPartnershipsModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </motion.div>
  );
}
