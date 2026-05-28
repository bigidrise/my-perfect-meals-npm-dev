import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowLeft, ShieldCheck, ShieldX, AlertTriangle, RefreshCw } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useCopilot } from "@/components/copilot/CopilotContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

interface ScanResult {
  ingredient: string;
  safetyStatus: "SAFE" | "CAUTION" | "TOXIC";
  safe: boolean;
  reason?: string;
  substitution?: string;
  wellnessScore?: number;
  wellnessNotes?: string;
  betterOptions?: string[];
}

const QUICK_CHECKS = [
  "chocolate", "grapes", "onion", "garlic", "avocado",
  "salmon", "blueberries", "sweet potato", "peanut butter", "carrots",
  "apple", "broccoli", "eggs", "xylitol", "macadamia nuts",
];

export default function DogIngredientScanner() {
  const [, setLocation] = useLocation();
  const { open, setLastResponse } = useCopilot();
  const [ingredient, setIngredient] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);

  useEffect(() => {
    document.title = "Ingredient Scanner | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  function handleCopilotOpen() {
    open();
    setTimeout(() => {
      setLastResponse({
        title: "Dog Ingredient Safety Scanner",
        description:
          "Type any food or ingredient to instantly check if it's safe for your dog. The system runs it through the Toxic Ingredient Firewall — a curated list of known canine toxins — and returns a safety rating, the reason it's flagged (if any), and a safe substitution. Safe ingredients also receive a wellness score.",
        spokenText:
          "Type any food or ingredient to check if it's safe for your dog. The system screens it against known canine toxins and returns a safety rating, reason, and a safe alternative if needed.",
        autoClose: false,
      });
    }, 300);
  }

  async function handleScan(ingredientToScan?: string) {
    const target = (ingredientToScan || ingredient).trim();
    if (!target) return;

    setScanning(true);
    setResult(null);

    try {
      const res = await fetch(apiUrl("/api/companion/scan-ingredient"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient: target }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.ingredient.toLowerCase() !== data.ingredient.toLowerCase());
        return [data, ...filtered].slice(0, 10);
      });
    } catch {
      setResult({
        ingredient: target,
        safetyStatus: "CAUTION",
        safe: false,
        reason: "Could not complete scan. Please try again.",
      });
    } finally {
      setScanning(false);
    }
  }

  const statusConfig = {
    SAFE: {
      icon: ShieldCheck,
      color: "text-green-400",
      bg: "bg-green-900/20 border-green-500/30",
      label: "SAFE FOR DOGS",
      labelColor: "text-green-400",
    },
    CAUTION: {
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-900/20 border-amber-500/30",
      label: "USE WITH CAUTION",
      labelColor: "text-amber-400",
    },
    TOXIC: {
      icon: ShieldX,
      color: "text-red-400",
      bg: "bg-red-900/20 border-red-500/30",
      label: "NOT SAFE FOR DOGS",
      labelColor: "text-red-400",
    },
  };

  const historyStatusDot: Record<string, string> = {
    SAFE: "bg-green-500",
    CAUTION: "bg-amber-500",
    TOXIC: "bg-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-24"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PillButton onClick={() => setLocation("/companion")}>
                <ArrowLeft className="h-3 w-3" /> Back
              </PillButton>
              <h1 className="text-sm font-bold text-white">Ingredient Scanner</h1>
            </div>
            <PillButton onClick={handleCopilotOpen}>How it works</PillButton>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Search */}
        <div className="mb-5">
          <p className="text-white/60 text-xs mb-3">Type any food or ingredient to check if it's safe for your dog.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/60"
                placeholder="e.g. chocolate, grapes, salmon..."
                value={ingredient}
                onChange={(e) => setIngredient(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
              />
            </div>
            <PillButton onClick={() => handleScan()} disabled={scanning || !ingredient.trim()}>
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Scan"}
            </PillButton>
          </div>
        </div>

        {/* Quick Checks */}
        <div className="mb-6">
          <p className="text-white/40 text-[10px] uppercase font-semibold mb-2">Quick checks</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHECKS.map((q) => (
              <PillButton
                key={q}
                onClick={() => {
                  setIngredient(q);
                  handleScan(q);
                }}
              >
                {q}
              </PillButton>
            ))}
          </div>
        </div>

        {/* Scan Result */}
        <AnimatePresence mode="wait">
          {result && (() => {
            const config = statusConfig[result.safetyStatus];
            const Icon = config.icon;
            return (
              <motion.div
                key={result.ingredient}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`border rounded-2xl p-5 mb-6 ${config.bg}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Icon className={`h-7 w-7 ${config.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-white font-bold text-base capitalize">{result.ingredient}</p>
                    <p className={`text-xs font-bold uppercase tracking-wide ${config.labelColor}`}>
                      {config.label}
                    </p>
                  </div>
                </div>

                {result.wellnessScore && result.safetyStatus === "SAFE" && (
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-white/50 text-xs">Wellness Score:</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-3 rounded-sm ${i < (result.wellnessScore || 0) ? "bg-orange-500" : "bg-white/10"}`}
                        />
                      ))}
                    </div>
                    <span className="text-orange-400 text-xs font-bold">{result.wellnessScore}/10</span>
                  </div>
                )}

                {result.wellnessNotes && (
                  <p className="text-white/70 text-sm mb-3">{result.wellnessNotes}</p>
                )}

                {result.reason && (
                  <div className="bg-black/30 rounded-xl p-3 mb-3">
                    <p className="text-white/50 text-[10px] uppercase font-semibold mb-1">Why it's flagged</p>
                    <p className="text-white/80 text-xs leading-relaxed">{result.reason}</p>
                  </div>
                )}

                {result.substitution && (
                  <div className="bg-green-900/20 border border-green-500/20 rounded-xl p-3 mb-3">
                    <p className="text-green-400 text-[10px] uppercase font-semibold mb-1">Safe alternative</p>
                    <p className="text-white/80 text-xs">{result.substitution}</p>
                  </div>
                )}

                {result.betterOptions && result.betterOptions.length > 0 && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase font-semibold mb-2">Better options</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.betterOptions.map((opt) => (
                        <PillButton
                          key={opt}
                          onClick={() => {
                            setIngredient(opt);
                            handleScan(opt);
                          }}
                        >
                          {opt}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Scan History */}
        {history.length > 1 && (
          <div className="mb-6">
            <p className="text-white/40 text-[10px] uppercase font-semibold mb-2">Recent scans</p>
            <div className="space-y-1.5">
              {history.slice(1).map((h) => (
                <button
                  key={`${h.ingredient}-${h.safetyStatus}`}
                  onClick={() => {
                    setIngredient(h.ingredient);
                    setResult(h);
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 text-left"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${historyStatusDot[h.safetyStatus]}`} />
                  <span className="text-white/70 text-xs capitalize flex-1">{h.ingredient}</span>
                  <span className={`text-[10px] font-semibold ${
                    h.safetyStatus === "SAFE" ? "text-green-400" :
                    h.safetyStatus === "CAUTION" ? "text-amber-400" : "text-red-400"
                  }`}>{h.safetyStatus}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sources note */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-3 mb-4">
          <p className="text-white/40 text-[10px] leading-relaxed">
            <strong className="text-white/60">Source:</strong> Toxicity data sourced from ASPCA Animal Poison Control Center, AVMA companion animal safety guidelines, and peer-reviewed veterinary toxicology references. This scanner is for wellness awareness only — consult your veterinarian for any health concerns.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
