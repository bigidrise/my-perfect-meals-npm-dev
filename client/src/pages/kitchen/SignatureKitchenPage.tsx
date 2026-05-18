import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { PillButton } from "@/components/ui/pill-button";
import { ArrowLeft, ChefHat, Utensils, Sparkles } from "lucide-react";

type KitchenProfile = {
  slug: string;
  displayName: string;
  bio: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  brandingImageUrl: string | null;
  isFeatured: boolean;
  creatorCategory: string;
  cuisineTypes: string[];
  flavorProfiles: string[];
};

export default function SignatureKitchenPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ slug: string }>();
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-black pb-20"
    >
      {/* Back button */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-safe"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => setLocation("/lifestyle")}
          className="p-2 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden">
        {kitchen.heroImageUrl ? (
          <img
            src={kitchen.heroImageUrl}
            alt={kitchen.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-black via-orange-950/40 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        <div className="absolute bottom-6 left-4 right-4">
          <div className="flex items-end gap-4">
            {kitchen.logoUrl ? (
              <img
                src={kitchen.logoUrl}
                alt=""
                className="w-14 h-14 rounded-xl border-2 border-orange-500/40 object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center flex-shrink-0">
                <ChefHat className="h-7 w-7 text-orange-400" />
              </div>
            )}
            <div className="min-w-0">
              {kitchen.isFeatured && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 mb-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">Featured Kitchen</span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-white leading-tight">{kitchen.displayName}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Bio */}
        {kitchen.bio && (
          <p className="text-white/70 text-sm leading-relaxed">{kitchen.bio}</p>
        )}

        {/* Tags */}
        {(kitchen.cuisineTypes.length > 0 || kitchen.flavorProfiles.length > 0) && (
          <div className="space-y-2">
            {kitchen.cuisineTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {kitchen.cuisineTypes.map(c => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-300 border border-orange-500/20">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {kitchen.flavorProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {kitchen.flavorProfiles.map(f => (
                  <span key={f} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/10">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* CTA */}
        <div className="rounded-xl bg-gradient-to-br from-orange-950/40 via-black to-black border border-orange-500/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-400" />
            <h2 className="text-white font-semibold">Create a Dish</h2>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Generate a personalized recipe crafted in the style of {kitchen.displayName}. Your dietary rules, macros, and health protocols are always respected.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/lifestyle/create-a-dish")}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors active:scale-95"
          >
            Create a Dish with {kitchen.displayName}
          </button>
        </div>

        <p className="text-center text-xs text-white/25 pb-2">
          Powered by My Perfect Meals AI — your dietary protocols and medical guidelines always apply.
        </p>
      </div>
    </motion.div>
  );
}
