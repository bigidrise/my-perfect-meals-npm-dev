import { useState, useEffect, type ReactNode } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { PillButton } from "@/components/ui/pill-button";
import {
  ArrowLeft,
  ChefHat,
  Utensils,
  Sparkles,
  Flame,
  Globe,
  Layers,
} from "lucide-react";

type KitchenProfile = {
  slug: string;
  displayName: string;
  bio: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  brandingImageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  isAdmin: boolean;
  creatorCategory: string;
  cuisineTypes: string[];
  flavorProfiles: string[];
  techniques: string[];
  primaryColor: string | null;
  accentColor: string | null;
};

function buildExpectationLine(kitchen: KitchenProfile): string {
  const parts: string[] = [];
  if (kitchen.cuisineTypes.length > 0) {
    parts.push(kitchen.cuisineTypes.slice(0, 2).join(" and ") + " cooking");
  }
  if (kitchen.flavorProfiles.length > 0) {
    parts.push(kitchen.flavorProfiles.slice(0, 2).join(", ").toLowerCase() + " flavors");
  }
  if (kitchen.techniques.length > 0) {
    parts.push(kitchen.techniques.slice(0, 2).join(" and ").toLowerCase() + " technique");
  }
  if (parts.length === 0) return "Every recipe is crafted to reflect this kitchen's unique culinary identity.";
  return `Expect ${parts.join(" · ")}. Your macros, dietary rules, and health protocols always apply.`;
}

function TagPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
        color: `${color}`,
      }}
    >
      {label}
    </span>
  );
}

function IdentitySection({
  icon,
  label,
  items,
  color,
}: {
  icon: ReactNode;
  label: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <TagPill key={item} label={item} color={color} />
        ))}
      </div>
    </div>
  );
}

export default function SignatureKitchenPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ slug: string }>("/kitchen/:slug");
  const slug = params?.slug ?? "";
  const [kitchen, setKitchen] = useState<KitchenProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    window.scrollTo({ top: 0, behavior: "instant" });

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/kitchens/${slug}`), {
          headers: getAuthHeaders(),
        });
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setKitchen(data);
        document.title = `${data.displayName} | My Perfect Meals`;
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading kitchen…</div>
      </div>
    );
  }

  if (notFound || !kitchen) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <ChefHat className="h-12 w-12 text-white/20" />
        <p className="text-white/40 text-sm text-center">This kitchen isn't available yet.</p>
        <PillButton onClick={() => setLocation("/lifestyle")}>Back to Lifestyle</PillButton>
      </div>
    );
  }

  const primary = kitchen.primaryColor ?? "#ea580c";
  const accent = kitchen.accentColor ?? "#f97316";
  const hasIdentity =
    kitchen.cuisineTypes.length > 0 ||
    kitchen.flavorProfiles.length > 0 ||
    kitchen.techniques.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-black pb-24"
    >
      {/* Back button */}
      <div
        className="fixed top-0 left-0 right-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => setLocation("/lifestyle")}
          className="p-2 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white/60 active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        {kitchen.heroImageUrl ? (
          <img
            src={kitchen.heroImageUrl}
            alt={kitchen.displayName}
            className="w-full h-auto block"
          />
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{
              minHeight: "320px",
              background: `radial-gradient(ellipse at center, #1a0a00 0%, #0a0500 60%, #000 100%)`,
            }}
          >
            {/* Marquee sign */}
            <div className="relative mx-6 w-full max-w-sm">
              {/* Outer border with bulbs */}
              <div
                className="relative rounded-sm px-6 py-5"
                style={{
                  border: `3px solid ${primary}`,
                  boxShadow: `0 0 30px ${primary}55, 0 0 60px ${primary}22, inset 0 0 20px #00000088`,
                  background: `linear-gradient(160deg, #0f0700 0%, #1a0c00 100%)`,
                }}
              >
                {/* Corner bulbs */}
                {[
                  "absolute -top-2 -left-2",
                  "absolute -top-2 -right-2",
                  "absolute -bottom-2 -left-2",
                  "absolute -bottom-2 -right-2",
                ].map((pos, i) => (
                  <span
                    key={i}
                    className={`${pos} w-3.5 h-3.5 rounded-full`}
                    style={{
                      backgroundColor: primary,
                      boxShadow: `0 0 8px ${primary}, 0 0 16px ${primary}88`,
                    }}
                  />
                ))}

                {/* Top row of small bulbs */}
                <div className="absolute -top-1.5 left-6 right-6 flex justify-between px-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: i % 2 === 0 ? primary : accent,
                        boxShadow: `0 0 6px ${i % 2 === 0 ? primary : accent}`,
                        opacity: 0.9,
                      }}
                    />
                  ))}
                </div>
                {/* Bottom row of small bulbs */}
                <div className="absolute -bottom-1.5 left-6 right-6 flex justify-between px-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: i % 2 === 0 ? accent : primary,
                        boxShadow: `0 0 6px ${i % 2 === 0 ? accent : primary}`,
                        opacity: 0.9,
                      }}
                    />
                  ))}
                </div>

                {/* Sign text */}
                <div className="text-center space-y-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.3em]"
                    style={{ color: `${primary}99` }}
                  >
                    ★ &nbsp; Welcome to &nbsp; ★
                  </p>
                  <h2
                    className="text-2xl font-black uppercase tracking-wide leading-tight"
                    style={{
                      color: primary,
                      textShadow: `0 0 20px ${primary}99, 0 0 40px ${primary}44`,
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    {kitchen.displayName}
                  </h2>
                  <div
                    className="h-px w-16 mx-auto my-1"
                    style={{ backgroundColor: `${primary}60` }}
                  />
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                    style={{ color: `${accent}bb` }}
                  >
                    Signature Kitchen
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, #000 0%, ${primary}22 50%, transparent 100%)`,
          }}
        />

        {/* Identity row */}
        <div className="absolute bottom-5 left-4 right-4">
          <div className="flex items-end gap-4">
            {kitchen.logoUrl ? (
              <img
                src={kitchen.logoUrl}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-lg"
                style={{ border: `2px solid ${primary}60` }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{
                  backgroundColor: `${primary}22`,
                  border: `2px solid ${primary}60`,
                }}
              >
                <ChefHat className="h-8 w-8" style={{ color: primary }} />
              </div>
            )}
            <div className="min-w-0 pb-1">
              {kitchen.isFeatured && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 mb-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">
                    Featured Kitchen
                  </span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
                {kitchen.displayName}
              </h1>
              {kitchen.cuisineTypes.length > 0 && (
                <p className="text-sm mt-0.5" style={{ color: `${primary}cc` }}>
                  {kitchen.cuisineTypes.slice(0, 2).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Admin Preview Banner */}
        {kitchen.isAdmin && !kitchen.isActive && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300 leading-relaxed">
              <span className="font-semibold">Admin Preview</span> — this kitchen is not yet live. Only you can see this page.
            </p>
          </div>
        )}

        {/* Bio */}
        {kitchen.bio && (
          <p className="text-white/75 text-sm leading-relaxed">{kitchen.bio}</p>
        )}

        {/* Divider */}
        {kitchen.bio && hasIdentity && (
          <div className="border-t border-white/8" />
        )}

        {/* Kitchen Identity Panel */}
        {hasIdentity && (
          <div
            className="rounded-2xl p-5 space-y-5"
            style={{
              background: `linear-gradient(135deg, ${primary}12 0%, #00000088 100%)`,
              border: `1px solid ${primary}25`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4" style={{ color: primary }} />
              <h2 className="text-sm font-semibold text-white">
                What this kitchen is built on
              </h2>
            </div>

            <IdentitySection
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Cuisine Focus"
              items={kitchen.cuisineTypes}
              color={primary}
            />
            <IdentitySection
              icon={<Flame className="h-3.5 w-3.5" />}
              label="Flavor Profile"
              items={kitchen.flavorProfiles}
              color={accent}
            />
            <IdentitySection
              icon={<Utensils className="h-3.5 w-3.5" />}
              label="Techniques"
              items={kitchen.techniques}
              color="#a3a3a3"
            />
          </div>
        )}

        {/* What to expect */}
        {hasIdentity && (
          <div className="rounded-xl px-4 py-3 bg-white/4 border border-white/8">
            <p className="text-xs text-white/50 leading-relaxed">
              <span className="text-white/70 font-medium">What to expect — </span>
              {buildExpectationLine(kitchen)}
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/8" />

        {/* CTA — full for admin or active kitchen; teaser for regular users */}
        {(kitchen.isAdmin || kitchen.isActive) ? (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: `linear-gradient(135deg, ${primary}20 0%, #000000aa 100%)`,
              border: `1px solid ${primary}35`,
            }}
          >
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" style={{ color: primary }} />
              <h2 className="text-white font-semibold text-base">Create a Dish</h2>
            </div>
            <p className="text-sm text-white/55 leading-relaxed">
              Generate a personalized recipe crafted in the style of{" "}
              <span className="text-white/80 font-medium">{kitchen.displayName}</span>.
              Your dietary rules, macros, and health protocols are always respected.
            </p>
            <button
              type="button"
              onClick={() =>
                setLocation(`/lifestyle/create-a-dish?kitchen=${kitchen.slug}`)
              }
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-transform active:scale-95 shadow-lg"
              style={{ backgroundColor: primary }}
            >
              Create a Dish with {kitchen.displayName}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/4 border border-white/8 p-5 space-y-3 text-center">
            <Sparkles className="h-8 w-8 mx-auto" style={{ color: `${primary}88` }} />
            <h2 className="text-white font-semibold">Coming Soon</h2>
            <p className="text-sm text-white/45 leading-relaxed">
              {kitchen.displayName} is opening soon. Stay tuned for personalized
              AI-powered recipes crafted in this kitchen's style.
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-white/20 pb-2">
          Powered by My Perfect Meals AI — your dietary protocols and medical guidelines always apply.
        </p>
      </div>
    </motion.div>
  );
}
