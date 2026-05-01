// client/src/components/BuilderSourcePill.tsx
//
// Builder identity badge — shows which medical/dietary protocol applies to this meal.
// Source of truth: builderType prop → pattern-matched source string → user's dietary restrictions.
// Rules:
//   - One pill per meal card.
//   - Never infers from ingredients or nutrition values.
//   - Never mixes with the medical safety shield (HealthBadgesPopover).

import { useProClient } from "@/contexts/ProClientContext";
import { useAuth } from "@/contexts/AuthContext";

interface Config {
  label: string;
  color: string;
}

const BUILDER_CONFIG: Record<string, Config> = {
  diabetic:          { label: "Diabetic",          color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  glp1:              { label: "GLP-1 Friendly",    color: "bg-violet-500/20 border-violet-400/40 text-violet-300" },
  anti_inflammatory: { label: "Anti-Inflammatory", color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  cardiac:           { label: "Cardiac Health",    color: "bg-red-500/20 border-red-400/40 text-red-300" },
  renal:             { label: "Kidney Disease",    color: "bg-teal-500/20 border-teal-400/40 text-teal-300" },
  liver_support:     { label: "Liver Support",     color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  liver_disease:     { label: "Liver Disease",     color: "bg-yellow-600/20 border-yellow-500/40 text-yellow-400" },
  oncology:          { label: "Cancer Protocol",   color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

function resolveBuilderKey(source: string): string | null {
  const s = source.toLowerCase().replace(/-/g, " ");
  if (s.includes("glp 1") || s.includes("glp1"))                            return "glp1";
  if (s.includes("anti") && s.includes("inflam"))                           return "anti_inflammatory";
  if (s.includes("oncol") || s.includes("cancer") || s.includes("oncology support")) return "oncology";
  if (s.includes("cardiac") || s.includes("heart health"))                  return "cardiac";
  if (s.includes("renal") || s.includes("kidney"))                          return "renal";
  if (s.includes("liver disease"))                                           return "liver_disease";
  if (s.includes("liver support") || s.includes("liver"))                   return "liver_support";
  if (s.includes("diabet"))                                                  return "diabetic";
  return null;
}

interface BuilderSourcePillProps {
  /**
   * Canonical builder key (e.g. "diabetic", "glp1") OR a free-form source
   * string (e.g. "Diabetic Meal Plan (Week of Apr 13)"). Both are accepted.
   * When omitted, falls back to the user's active dietary restrictions.
   */
  source?: string | null;
  className?: string;
}

export default function BuilderSourcePill({ source, className = "" }: BuilderSourcePillProps) {
  const { isProCareMode } = useProClient();
  const { user } = useAuth();

  if (isProCareMode) return null;

  // 1) Try explicit prop first
  let resolvedSource = source ?? null;

  // 2) Fall back to user's active dietary restrictions so every card shows the
  //    correct protocol pill — not just builder-specific pages.
  if (!resolvedSource) {
    const restrictions: string[] = (user as any)?.dietaryRestrictions ?? [];
    for (const r of restrictions) {
      if (resolveBuilderKey(r)) { resolvedSource = r; break; }
    }
  }

  if (!resolvedSource) return null;

  const key = BUILDER_CONFIG[resolvedSource] ? resolvedSource : resolveBuilderKey(resolvedSource);
  if (!key) return null;

  const { label, color } = BUILDER_CONFIG[key];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color} ${className}`}
    >
      {label}
    </span>
  );
}
