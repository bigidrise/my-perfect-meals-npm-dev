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
  BookOpen,
  Wand2,
  Coffee,
  Apple,
  Droplets,
  UtensilsCrossed,
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

type SignatureItem = {
  id: string;
  kind: "dish" | "sauce" | "beverage" | "snack" | "recipe";
  title: string;
  subtitle: string | null;
  description: string | null;
  mediaUrl: string | null;
  tags: string[];
  techniques: string[];
  isFeatured: boolean;
};

type CollectionItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  mediaUrl: string | null;
};

type SignatureCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverMediaUrl: string | null;
  isFeatured: boolean;
  items: CollectionItem[];
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

function TagPill({ label, color }: { label: string; color: string }) {
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
  icon, label, items, color,
}: {
  icon: ReactNode; label: string; items: string[]; color: string;
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

function kindIcon(kind: string, color: string) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "sauce": return <Droplets className={cls} style={{ color }} />;
    case "beverage": return <Coffee className={cls} style={{ color }} />;
    case "snack": return <Apple className={cls} style={{ color }} />;
    case "recipe": return <BookOpen className={cls} style={{ color }} />;
    default: return <UtensilsCrossed className={cls} style={{ color }} />;
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "sauce": return "Sauce";
    case "beverage": return "Beverage";
    case "snack": return "Snack";
    case "recipe": return "Recipe";
    default: return "Dish";
  }
}

function SignatureItemCard({ item, primary }: { item: SignatureItem; primary: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: `${primary}20`, background: `linear-gradient(135deg, ${primary}0d 0%, #0a0a0a 100%)` }}
    >
      {item.mediaUrl ? (
        <div className="relative h-40 overflow-hidden">
          <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${primary}33`, border: `1px solid ${primary}50` }}
          >
            {kindIcon(item.kind, primary)}
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: primary }}>
              {kindLabel(item.kind)}
            </span>
          </div>
          {item.isFeatured && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/40">
              <Sparkles className="h-3 w-3 text-amber-300" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-200">Featured</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className="h-28 flex items-center justify-center"
          style={{ background: `${primary}12` }}
        >
          <div className="flex flex-col items-center gap-2 opacity-40">
            {kindIcon(item.kind, primary)}
            <span className="text-[10px] uppercase tracking-widest" style={{ color: primary }}>
              {kindLabel(item.kind)}
            </span>
          </div>
        </div>
      )}
      <div className="p-3 space-y-1">
        <p className="text-white font-semibold text-sm leading-snug">{item.title}</p>
        {item.subtitle && (
          <p className="text-white/50 text-xs leading-relaxed">{item.subtitle}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: `${primary}18`, color: `${primary}cc` }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionCard({ collection, primary }: { collection: SignatureCollection; primary: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border flex-shrink-0 w-56"
      style={{ borderColor: `${primary}25`, background: `linear-gradient(135deg, ${primary}12 0%, #0a0a0a 100%)` }}
    >
      {collection.coverMediaUrl ? (
        <div className="relative h-32 overflow-hidden">
          <img src={collection.coverMediaUrl} alt={collection.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        </div>
      ) : (
        <div
          className="h-20 flex items-center justify-center"
          style={{ background: `${primary}15` }}
        >
          <BookOpen className="h-7 w-7 opacity-30" style={{ color: primary }} />
        </div>
      )}
      <div className="p-3 space-y-1">
        <p className="text-white font-semibold text-sm">{collection.title}</p>
        {collection.description && (
          <p className="text-white/45 text-xs leading-relaxed line-clamp-2">{collection.description}</p>
        )}
        {collection.items.length > 0 && (
          <p className="text-[10px] font-medium pt-1" style={{ color: `${primary}99` }}>
            {collection.items.length} {collection.items.length === 1 ? "item" : "items"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SignatureKitchenPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ slug: string }>("/kitchen/:slug");
  const slug = params?.slug ?? "";
  const [kitchen, setKitchen] = useState<KitchenProfile | null>(null);
  const [items, setItems] = useState<SignatureItem[]>([]);
  const [collections, setCollections] = useState<SignatureCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    window.scrollTo({ top: 0, behavior: "instant" });

    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, itemsRes, collectionsRes] = await Promise.all([
          fetch(apiUrl(`/api/kitchens/${slug}`), { headers: getAuthHeaders() }),
          fetch(apiUrl(`/api/kitchens/${slug}/items`), { headers: getAuthHeaders() }),
          fetch(apiUrl(`/api/kitchens/${slug}/collections`), { headers: getAuthHeaders() }),
        ]);

        if (!profileRes.ok) { setNotFound(true); return; }
        const data = await profileRes.json();
        setKitchen(data);
        document.title = `${data.displayName} | My Perfect Meals`;

        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData.items ?? []);
        }
        if (collectionsRes.ok) {
          const collData = await collectionsRes.json();
          setCollections(collData.collections ?? []);
        }
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

  const featuredItems = items.filter((i) => i.isFeatured);
  const allItems = items;
  const hasItems = allItems.length > 0;
  const hasCollections = collections.length > 0;
  const hasLibrary = hasItems || hasCollections;

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
      <div className="relative w-full">
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
            <div className="relative mx-6 w-full max-w-sm">
              <div
                className="relative rounded-sm px-6 py-5"
                style={{
                  border: `3px solid ${primary}`,
                  boxShadow: `0 0 30px ${primary}55, 0 0 60px ${primary}22, inset 0 0 20px #00000088`,
                  background: `linear-gradient(160deg, #0f0700 0%, #1a0c00 100%)`,
                }}
              >
                {[
                  "absolute -top-2 -left-2",
                  "absolute -top-2 -right-2",
                  "absolute -bottom-2 -left-2",
                  "absolute -bottom-2 -right-2",
                ].map((pos, i) => (
                  <span
                    key={i}
                    className={`${pos} w-3.5 h-3.5 rounded-full`}
                    style={{ backgroundColor: primary, boxShadow: `0 0 8px ${primary}, 0 0 16px ${primary}88` }}
                  />
                ))}
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
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: `${primary}99` }}>
                    ★ &nbsp; Welcome to &nbsp; ★
                  </p>
                  <h2
                    className="text-2xl font-black uppercase tracking-wide leading-tight"
                    style={{ color: primary, textShadow: `0 0 20px ${primary}99, 0 0 40px ${primary}44`, fontFamily: "Georgia, serif" }}
                  >
                    {kitchen.displayName}
                  </h2>
                  <div className="h-px w-16 mx-auto my-1" style={{ backgroundColor: `${primary}60` }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: `${accent}bb` }}>
                    Signature Kitchen
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Identity row */}
      <div className="px-4 pt-8 pb-2 max-w-xl mx-auto">
        <div className="flex items-center gap-4">
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
              style={{ backgroundColor: `${primary}22`, border: `2px solid ${primary}60` }}
            >
              <ChefHat className="h-8 w-8" style={{ color: primary }} />
            </div>
          )}
          <div className="min-w-0">
            {kitchen.isFeatured && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 mb-1.5">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">Featured Kitchen</span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">{kitchen.displayName}</h1>
            {kitchen.cuisineTypes.length > 0 && (
              <p className="text-sm mt-0.5" style={{ color: `${primary}cc` }}>
                {kitchen.cuisineTypes.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-4 space-y-6">

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

        {kitchen.bio && hasIdentity && <div className="border-t border-white/8" />}

        {/* Kitchen Philosophy */}
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
              <h2 className="text-sm font-semibold text-white">What this kitchen is built on</h2>
            </div>
            <IdentitySection icon={<Globe className="h-3.5 w-3.5" />} label="Cuisine Focus" items={kitchen.cuisineTypes} color={primary} />
            <IdentitySection icon={<Flame className="h-3.5 w-3.5" />} label="Flavor Profile" items={kitchen.flavorProfiles} color={accent} />
            <IdentitySection icon={<Utensils className="h-3.5 w-3.5" />} label="Techniques" items={kitchen.techniques} color="#a3a3a3" />
          </div>
        )}

        {hasIdentity && (
          <div className="rounded-xl px-4 py-3 bg-white/4 border border-white/8">
            <p className="text-xs text-white/50 leading-relaxed">
              <span className="text-white/70 font-medium">What to expect — </span>
              {buildExpectationLine(kitchen)}
            </p>
          </div>
        )}

        <div className="border-t border-white/8" />

        {/* ── SIGNATURE DISHES ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: primary }} />
            <h2 className="text-base font-semibold text-white">Signature Dishes</h2>
          </div>

          {hasItems ? (
            <div className="grid grid-cols-2 gap-3">
              {(featuredItems.length > 0 ? featuredItems : allItems).slice(0, 6).map((item) => (
                <SignatureItemCard key={item.id} item={item} primary={primary} />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-dashed p-8 flex flex-col items-center gap-3 text-center"
              style={{ borderColor: `${primary}30` }}
            >
              <ChefHat className="h-10 w-10 opacity-20" style={{ color: primary }} />
              <div>
                <p className="text-white/50 text-sm font-medium">Chef's library coming soon</p>
                <p className="text-white/30 text-xs mt-1 leading-relaxed">
                  Signature dishes, recipes, and sauces will appear here as the chef builds their library.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── FEATURED COLLECTIONS ── */}
        {(hasCollections || !hasItems) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: accent }} />
              <h2 className="text-base font-semibold text-white">Collections</h2>
            </div>

            {hasCollections ? (
              <div className="-mx-4 px-4 overflow-x-auto">
                <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                  {collections.map((col) => (
                    <CollectionCard key={col.id} collection={col} primary={primary} />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-dashed p-6 flex flex-col items-center gap-2 text-center"
                style={{ borderColor: `${accent}25` }}
              >
                <Layers className="h-8 w-8 opacity-20" style={{ color: accent }} />
                <p className="text-white/35 text-xs leading-relaxed">
                  Curated collections — Meal Prep, Date Night, High Protein — will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/8" />

        {/* ── HOW SIGNATURE KITCHENS WORK ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: `linear-gradient(135deg, ${primary}0d 0%, #00000099 100%)`,
            border: `1px solid ${primary}20`,
          }}
        >
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" style={{ color: primary }} />
            <h2 className="text-sm font-semibold text-white">How Signature Kitchens Work</h2>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${primary}20`, border: `1px solid ${primary}35` }}
              >
                <BookOpen className="h-3.5 w-3.5" style={{ color: primary }} />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">Chef Library</p>
                <p className="text-white/45 text-xs leading-relaxed mt-0.5">
                  Real dishes, recipes, flavors, and cooking philosophy form the foundation of this kitchen's identity.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${accent}20`, border: `1px solid ${accent}35` }}
              >
                <Wand2 className="h-3.5 w-3.5" style={{ color: accent }} />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">Adaptive Culinary Intelligence</p>
                <p className="text-white/45 text-xs leading-relaxed mt-0.5">
                  My Perfect Meals extends this kitchen's style through AI generation that adapts meals to your goals, lifestyle, and wellness needs — while preserving the chef's flavor identity.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/30 leading-relaxed border-t border-white/8 pt-3">
            Your kitchen remains uniquely yours. The platform adapts the experience around each user while preserving the spirit of the chef's culinary approach.
          </p>
        </div>

        {/* ── CREATE WITH CHEF CTA ── */}
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
              <h2 className="text-white font-semibold text-base">Create a Dish With {kitchen.displayName}</h2>
            </div>
            <p className="text-sm text-white/55 leading-relaxed">
              Generate a personalized recipe crafted in the style of{" "}
              <span className="text-white/80 font-medium">{kitchen.displayName}</span>.
              Your dietary rules, macros, and health protocols are always respected.
            </p>
            <button
              type="button"
              onClick={() => setLocation(`/lifestyle/create-a-dish?kitchen=${kitchen.slug}`)}
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
