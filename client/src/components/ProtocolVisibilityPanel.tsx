import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

interface ProtocolVisibilityPanelProps {
  user: any;
  whyThisComplies?: string | null;
  reasoning?: string | null;
  context?: "meal" | "beverage" | "restaurant";
}

const PROTOCOL_MAP: Record<string, { label: string; level: "high" | "moderate" }> = {
  diabetes: { label: "Diabetes Protocol", level: "high" },
  diabetic: { label: "Diabetes Protocol", level: "high" },
  "glp-1": { label: "GLP-1 Protocol", level: "high" },
  glp1: { label: "GLP-1 Protocol", level: "high" },
  semaglutide: { label: "GLP-1 Protocol", level: "high" },
  "anti-inflammatory": { label: "Anti-Inflammatory Protocol", level: "high" },
  "anti_inflammatory": { label: "Anti-Inflammatory Protocol", level: "high" },
  cardiac: { label: "Cardiac Protocol", level: "high" },
  "heart disease": { label: "Cardiac Protocol", level: "high" },
  "heart-disease": { label: "Cardiac Protocol", level: "high" },
  renal: { label: "Renal Protocol", level: "high" },
  "kidney disease": { label: "Renal Protocol", level: "high" },
  ckd: { label: "Renal Protocol", level: "high" },
  oncology: { label: "Oncology Protocol", level: "high" },
  cancer: { label: "Oncology Protocol", level: "high" },
  "thyroid-support": { label: "Thyroid Support Protocol", level: "moderate" },
  thyroid: { label: "Thyroid Support Protocol", level: "moderate" },
  hashimotos: { label: "Thyroid Support Protocol", level: "moderate" },
  "hormone-optimization": { label: "Hormone Optimization Protocol", level: "moderate" },
  hormone: { label: "Hormone Optimization Protocol", level: "moderate" },
  menopause: { label: "Menopause Protocol", level: "moderate" },
  perimenopause: { label: "Menopause Protocol", level: "moderate" },
  "liver-disease": { label: "Liver Support Protocol", level: "moderate" },
  "liver-support": { label: "Liver Support Protocol", level: "moderate" },
  nafld: { label: "Liver Support Protocol", level: "moderate" },
};

const DIET_MAP: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Ketogenic",
  "low-carb": "Low-Carb",
  paleo: "Paleo",
  "gluten-free": "Gluten-Free",
  "dairy-free": "Dairy-Free",
  halal: "Halal",
  kosher: "Kosher",
  carnivore: "Carnivore",
  mediterranean: "Mediterranean",
};

function getActiveProtocols(user: any): Array<{ label: string; level: "high" | "moderate" }> {
  const seen = new Set<string>();
  const results: Array<{ label: string; level: "high" | "moderate" }> = [];

  const checkSlug = (slug: string) => {
    if (!slug) return;
    const normalized = slug.toLowerCase().trim();
    const match = PROTOCOL_MAP[normalized];
    if (match && !seen.has(match.label)) {
      seen.add(match.label);
      results.push(match);
    }
  };

  if (user?.specialtyCondition) checkSlug(user.specialtyCondition);
  if (Array.isArray(user?.medicalConditions)) user.medicalConditions.forEach(checkSlug);
  if (user?.oncologySupportContext) {
    if (!seen.has("Oncology Protocol")) {
      seen.add("Oncology Protocol");
      results.push({ label: "Oncology Protocol", level: "high" });
    }
  }

  return results;
}

function getActiveDiets(user: any): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const checkDiet = (d: string) => {
    if (!d) return;
    const normalized = d.toLowerCase().trim();
    const label = DIET_MAP[normalized];
    if (label && !seen.has(label)) {
      seen.add(label);
      results.push(label);
    }
  };

  if (Array.isArray(user?.dietaryRestrictions)) user.dietaryRestrictions.forEach(checkDiet);
  if (user?.dietType) checkDiet(user.dietType);

  return results;
}

function getMacroSummary(user: any): string | null {
  const cal = user?.dailyCalorieTarget;
  const prot = user?.dailyProteinTarget;
  if (!cal && !prot) return null;
  const parts: string[] = [];
  if (cal) parts.push(`${cal} cal/day`);
  if (prot) parts.push(`${prot}g protein target`);
  return parts.join(" · ");
}

export default function ProtocolVisibilityPanel({
  user,
  whyThisComplies,
  reasoning,
  context = "meal",
}: ProtocolVisibilityPanelProps) {
  const [open, setOpen] = useState(false);

  const protocols = getActiveProtocols(user);
  const diets = getActiveDiets(user);
  const macroSummary = getMacroSummary(user);
  const explanation = whyThisComplies || reasoning || null;

  const hasProtocols = protocols.length > 0;
  const hasDiets = diets.length > 0;
  const hasMacros = !!macroSummary;

  if (!hasProtocols && !hasDiets && !hasMacros) return null;

  const contextLabel =
    context === "beverage"
      ? "this drink"
      : context === "restaurant"
      ? "this recommendation"
      : "this meal";

  const highProtocols = protocols.filter((p) => p.level === "high");
  const moderateProtocols = protocols.filter((p) => p.level === "moderate");

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left active:bg-white/5 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-white/80">
            How This Was Built For You
          </span>
          {hasProtocols && (
            <span className="text-[10px] bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-full px-2 py-0.5 font-medium">
              {protocols.length} Protocol{protocols.length !== 1 ? "s" : ""} Applied
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/8">
          {/* Medical Protocols */}
          {hasProtocols && (
            <div className="pt-3">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">
                Medical Protocols Active
              </p>
              <div className="space-y-1.5">
                {highProtocols.map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-xs text-white/80">{p.label}</span>
                    <span className="text-[10px] text-orange-400/70 font-medium">High</span>
                  </div>
                ))}
                {moderateProtocols.map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70 flex-shrink-0" />
                    <span className="text-xs text-white/70">{p.label}</span>
                    <span className="text-[10px] text-amber-400/60 font-medium">Moderate</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dietary Identity */}
          {hasDiets && (
            <div className={hasProtocols ? "" : "pt-3"}>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">
                Dietary Identity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {diets.map((d) => (
                  <span
                    key={d}
                    className="text-[11px] bg-white/8 border border-white/10 text-white/65 rounded-full px-2.5 py-0.5"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Macro Targets */}
          {hasMacros && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1.5">
                Macro Targets Applied
              </p>
              <p className="text-xs text-white/60">{macroSummary}</p>
            </div>
          )}

          {/* Why This Complies */}
          {explanation && (
            <div className="bg-white/5 border border-white/8 rounded-lg p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1.5">
                Why {contextLabel} fits your profile
              </p>
              <p className="text-xs text-white/65 leading-relaxed">{explanation}</p>
            </div>
          )}

          {!explanation && (
            <p className="text-[11px] text-white/35 leading-relaxed">
              The AI applied all active protocols and dietary rules from your profile when generating {contextLabel}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
