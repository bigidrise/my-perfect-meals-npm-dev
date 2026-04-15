import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getLocation } from "@/lib/capacitorLocation";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Search,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import ThinkingDots from "@/components/ThinkingDots";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

interface ScoredRestaurant {
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  placeId?: string;
  score: number;
  tier: "HIGH_MATCH" | "ADAPTABLE" | "BLOCKED";
  badges: string[];
  reasons: string[];
}

interface FindNearbyResponse {
  diet: string;
  zipCode: string;
  highMatch: ScoredRestaurant[];
  adaptable: ScoredRestaurant[];
  totalScored: number;
}

const DIET_LABELS: Record<string, string> = {
  kosher: "Kosher",
  halal: "Halal",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Keto",
  general: "No restriction",
};

const TIER_COLORS = {
  HIGH_MATCH: "text-emerald-400",
  ADAPTABLE:  "text-amber-400",
  BLOCKED:    "text-red-400",
};

const BADGE_COLORS: Record<string, string> = {
  Kosher:      "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Halal:       "bg-teal-500/20 text-teal-300 border-teal-500/40",
  Vegan:       "bg-green-500/20 text-green-300 border-green-500/40",
  Vegetarian:  "bg-lime-500/20 text-lime-300 border-lime-500/40",
  Seafood:     "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function RestaurantCard({ r }: { r: ScoredRestaurant }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        {r.photoUrl ? (
          <img
            src={r.photoUrl}
            alt={r.name}
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-white/10"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🍽️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-tight truncate">{r.name}</p>
          <p className="text-xs text-white/50 mt-0.5 truncate">{r.address}</p>
          {r.rating && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs text-white/70">
                {r.rating.toFixed(1)}
                {r.userRatingsTotal ? ` (${r.userRatingsTotal.toLocaleString()})` : ""}
              </span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-lg font-bold ${TIER_COLORS[r.tier]}`}>{r.score}</p>
          <p className="text-xs text-white/40">/ 100</p>
        </div>
      </div>

      <ScoreBar score={r.score} />

      {r.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.badges.map((b) => (
            <span
              key={b}
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${BADGE_COLORS[b] ?? "bg-white/10 text-white/70 border-white/20"}`}
            >
              {b}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Hide details" : "Why this result?"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-1"
          >
            {r.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
                {reason}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SectionHeader({
  dot,
  title,
  count,
}: {
  dot: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <span className="text-xs text-white/40 ml-auto">{count} found</span>
    </div>
  );
}

export default function RestaurantFinderPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const primaryDiet: string =
    Array.isArray((user as any)?.dietaryRestrictions) && (user as any).dietaryRestrictions.length > 0
      ? (user as any).dietaryRestrictions[0]
      : "general";

  const [zipCode, setZipCode] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [results, setResults] = useState<FindNearbyResponse | null>(null);

  const findMutation = useMutation({
    mutationFn: (zip: string) =>
      apiRequest("POST", "/api/restaurants/find-nearby", {
        zipCode: zip,
        diet: primaryDiet,
        userId: (user as any)?.id,
      }).then((r) => r.json()),
    onSuccess: (data: FindNearbyResponse) => {
      setResults(data);
    },
    onError: () => {
      toast({ title: "Could not find restaurants", description: "Try a different ZIP code.", variant: "destructive" });
    },
  });

  async function handleGPS() {
    setGpsLoading(true);
    try {
      const loc = await getLocation();
      const response = await apiRequest("POST", "/api/restaurants/reverse-geocode", {
        lat: loc.latitude,
        lng: loc.longitude,
      }).then((r) => r.json());
      if (response.zipCode) {
        setZipCode(response.zipCode);
        findMutation.mutate(response.zipCode);
      } else {
        toast({ title: "Could not detect ZIP code", description: "Enter it manually.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Location access denied", description: "Enter your ZIP code manually.", variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  }

  function handleSearch() {
    if (!/^\d{5}$/.test(zipCode)) {
      toast({ title: "Enter a valid 5-digit ZIP code", variant: "destructive" });
      return;
    }
    findMutation.mutate(zipCode);
  }

  const isLoading = findMutation.isPending || gpsLoading;
  const dietLabel = DIET_LABELS[primaryDiet] ?? primaryDiet;

  return (
    <MobileHeaderGuard>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">

          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/social-hub")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Find Restaurants</h1>
              <p className="text-xs text-white/50">Scored for your {dietLabel} protocol</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/50 flex-shrink-0" />
              <span className="text-sm text-white/70">Enter your ZIP code or use GPS</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="12345"
                inputMode="numeric"
                className="flex-1 bg-white/5 border-white/15 text-white placeholder:text-white/30 h-10"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGPS}
                disabled={isLoading}
                className="h-10 w-10 bg-white/5 border border-white/15 hover:bg-white/10 flex-shrink-0"
                title="Use my location"
              >
                <Navigation className="w-4 h-4 text-white/70" />
              </Button>
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white px-4 flex-shrink-0"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <ThinkingDots />
              <p className="text-sm text-white/50 mt-3">Scoring nearby restaurants for your diet</p>
            </div>
          )}

          {!isLoading && results && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {results.highMatch.length === 0 && results.adaptable.length === 0 && (
                <div className="text-center py-10 px-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    No restaurants nearby fully match your {dietLabel} dietary protocol.
                  </p>
                </div>
              )}

              {results.highMatch.length > 0 && (
                <section>
                  <SectionHeader dot="bg-emerald-500" title="Best Matches" count={results.highMatch.length} />
                  <div className="space-y-3">
                    {results.highMatch.map((r, i) => (
                      <RestaurantCard key={r.placeId ?? i} r={r} />
                    ))}
                  </div>
                </section>
              )}

              {results.highMatch.length === 0 && results.adaptable.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-2">
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    No restaurants nearby fully match your {dietLabel} dietary protocol. Showing options that can work with careful ordering.
                  </p>
                </div>
              )}

              {results.adaptable.length > 0 && (
                <section>
                  <SectionHeader dot="bg-amber-500" title="Can Work With Adjustments" count={results.adaptable.length} />
                  <div className="space-y-3">
                    {results.adaptable.map((r, i) => (
                      <RestaurantCard key={r.placeId ?? i} r={r} />
                    ))}
                  </div>
                </section>
              )}

              <p className="text-center text-xs text-white/30 pt-2">
                {results.totalScored} restaurants scored. Non-compatible results hidden.
              </p>
            </motion.div>
          )}

          {!isLoading && !results && (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">🗺️</p>
              <p className="text-white/50 text-sm">Enter your ZIP code to find {dietLabel}-compatible restaurants near you.</p>
            </div>
          )}

        </div>
      </div>
    </MobileHeaderGuard>
  );
}
