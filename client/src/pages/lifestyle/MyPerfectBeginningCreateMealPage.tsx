import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Baby,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Utensils,
  Info,
  Star,
  FlaskConical,
  Brain,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThinkingDots from "@/components/ThinkingDots";
import { Progress } from "@/components/ui/progress";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

// ── Types ────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

type AllergenId =
  | "peanut"
  | "tree_nuts"
  | "milk"
  | "egg"
  | "wheat"
  | "soy"
  | "sesame"
  | "fish"
  | "shellfish"
  | "other";

type AllergySeverity =
  | "confirmed_allergy"
  | "suspected_reaction"
  | "intolerance"
  | "preference_avoid"
  | "clinician_elimination";

interface AllergyEntry {
  allergenId: AllergenId;
  customAllergenName?: string;
  severity: AllergySeverity;
  emergencyMedication?: boolean;
}

interface ChildIngredient {
  name: string;
  quantity: string;
  unit?: string;
  prepNote?: string;
  substitutionNote?: string;
}

interface AllergenAlert {
  allergenId: string;
  message: string;
  severity: "confirmed_removed" | "suspected_removed" | "clinician_eliminated" | "cross_contact_warning";
}

interface RuleFiredEntry {
  ruleId: string;
  level: "A" | "B" | "C";
  description: string;
  action: string;
}

interface ChildRecipeResponse {
  recipeName: string;
  ageStageSuitability: string;
  ingredients: ChildIngredient[];
  instructions: string[];
  servingGuidance: string;
  textureAndChokingPreparation: string;
  allergenAlerts: AllergenAlert[];
  whyThisVersionIsBetter: string;
  serveSuggestion: string;
  funPresentationIdea: string;
  storageAndLunchboxGuidance?: string;
  askPediatricianNote?: string;
  rulesFireLog?: RuleFiredEntry[];
  // Parent Education Layer — AI-generated
  whyThisMealWasChosen?: string;
  reasoningTrace?: string[];
}

// ── Parent Education Layer — server-computed ──────────────────────────────────

interface MealConfidence {
  stars: number;
  profileCompleteness: number;
  fieldsUsed: string[];
}

interface ClinicalReviewStatus {
  protocolId: string;
  status: string;
  version: string;
  sources: string[];
}

interface PersonalizationLevel {
  stars: number;
  dimensionsUsed: string[];
}

interface ConflictResolution {
  protocol1: string;
  protocol2: string;
  resolution: string;
}

interface ParentEducationLayerData {
  mealConfidence: MealConfidence;
  clinicalReviewStatus: ClinicalReviewStatus[];
  personalizationLevel: PersonalizationLevel;
  conflictResolutions: ConflictResolution[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: { id: DevelopmentalStage; label: string; ageRange: string; emoji: string }[] = [
  { id: "early_infant",    label: "Early Infant",      ageRange: "Birth–~5 months",  emoji: "🍼" },
  { id: "beginning_foods", label: "Beginning Foods",   ageRange: "~6–11 months",     emoji: "🥣" },
  { id: "young_toddler",   label: "Young Toddler",     ageRange: "12–23 months",     emoji: "🧸" },
  { id: "toddler",         label: "Toddler",           ageRange: "2–3 years",        emoji: "🌟" },
  { id: "preschool",       label: "Preschool",         ageRange: "4–5 years",        emoji: "🎨" },
  { id: "early_school_age",label: "Early School Age",  ageRange: "6–8 years",        emoji: "📚" },
  { id: "growing_child",   label: "Growing Child",     ageRange: "9–12 years",       emoji: "🏃" },
];

const ALLERGENS: { id: AllergenId; label: string; emoji: string }[] = [
  { id: "peanut",    label: "Peanut",       emoji: "🥜" },
  { id: "tree_nuts", label: "Tree Nuts",    emoji: "🌰" },
  { id: "milk",      label: "Dairy/Milk",   emoji: "🥛" },
  { id: "egg",       label: "Egg",          emoji: "🥚" },
  { id: "wheat",     label: "Wheat/Gluten", emoji: "🌾" },
  { id: "soy",       label: "Soy",          emoji: "🫘" },
  { id: "sesame",    label: "Sesame",       emoji: "🫙" },
  { id: "fish",      label: "Fish",         emoji: "🐟" },
  { id: "shellfish", label: "Shellfish",    emoji: "🦐" },
];

const SEVERITY_LABELS: Record<AllergySeverity, string> = {
  confirmed_allergy: "Confirmed allergy",
  suspected_reaction: "Suspected reaction",
  intolerance: "Intolerance",
  preference_avoid: "Prefer to avoid",
  clinician_elimination: "Clinician-directed elimination",
};

// ── Early Infant Education Screen ─────────────────────────────────────────────

function EarlyInfantScreen({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="bg-blue-950/40 border-blue-400/30 backdrop-blur-lg">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-blue-500/20 flex-shrink-0">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Breast Milk & Formula Stage</h2>
              <p className="text-xs text-white/60 mt-0.5">Birth to ~5 months</p>
            </div>
          </div>

          <p className="text-sm text-white/80 leading-relaxed">
            At this stage, babies receive <strong className="text-white">all their nutrition</strong> from
            breast milk or formula. Solid foods are not safe or necessary yet — the digestive system
            and swallowing reflex are still developing.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Signs of readiness (usually ~6 months)</p>
            <ul className="space-y-1.5">
              {[
                "Can sit upright with minimal support",
                "Shows interest in food (reaches for your plate)",
                "Has lost the tongue-thrust reflex (doesn't push food out automatically)",
                "Can hold their head steady",
              ].map(sign => (
                <li key={sign} className="flex items-start gap-2 text-sm text-white/70">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  {sign}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/20">
            <p className="text-xs text-blue-200 font-medium mb-1">Questions to ask your pediatrician</p>
            <ul className="space-y-1 text-xs text-white/60">
              <li>• When is my baby ready to start solid foods?</li>
              <li>• Should I start with purées or baby-led weaning?</li>
              <li>• Which foods should I introduce first?</li>
              <li>• How do I know if my baby has a food allergy?</li>
              <li>• How much breast milk or formula should I continue giving?</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-400/20 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-200">
              Never add cereal or other foods to a baby's bottle. This does not help babies sleep longer
              and can cause overfeeding and choking.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-white/40">
        Return when your baby reaches the Beginning Foods stage (~6 months) and your pediatrician
        gives the green light.
      </p>

      <button
        onClick={onBack}
        className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all"
      >
        Back to My Perfect Beginning
      </button>
    </motion.div>
  );
}

// ── Allergen Selector ─────────────────────────────────────────────────────────

function AllergenSelector({
  allergies,
  onChange,
}: {
  allergies: AllergyEntry[];
  onChange: (a: AllergyEntry[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<AllergenId | null>(null);

  const isSelected = (id: AllergenId) => allergies.some(a => a.allergenId === id);

  const toggleAllergen = (id: AllergenId) => {
    if (isSelected(id)) {
      onChange(allergies.filter(a => a.allergenId !== id));
      if (expandedId === id) setExpandedId(null);
    } else {
      onChange([...allergies, { allergenId: id, severity: "confirmed_allergy", emergencyMedication: false }]);
      setExpandedId(id);
    }
  };

  const updateEntry = (id: AllergenId, patch: Partial<AllergyEntry>) => {
    onChange(allergies.map(a => a.allergenId === id ? { ...a, ...patch } : a));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ALLERGENS.map(({ id, label, emoji }) => {
          const selected = isSelected(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleAllergen(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selected
                  ? "bg-red-500/20 border-red-400/50 text-red-200"
                  : "bg-black/30 border-white/15 text-white/60 hover:border-white/30 hover:text-white/80"
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {allergies.map(entry => {
          const meta = ALLERGENS.find(a => a.id === entry.allergenId);
          if (!meta) return null;
          const isOpen = expandedId === entry.allergenId;

          return (
            <motion.div
              key={entry.allergenId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-1 rounded-lg border border-red-400/20 bg-red-950/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : entry.allergenId)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80"
                >
                  <span className="font-medium">
                    {meta.emoji} {meta.label} — {SEVERITY_LABELS[entry.severity]}
                  </span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Severity</label>
                      <select
                        value={entry.severity}
                        onChange={e => updateEntry(entry.allergenId, { severity: e.target.value as AllergySeverity })}
                        className="w-full text-xs bg-black/40 text-white border border-white/10 rounded-md px-2 py-1.5"
                      >
                        <option value="confirmed_allergy">Confirmed allergy (hard stop)</option>
                        <option value="suspected_reaction">Suspected reaction</option>
                        <option value="intolerance">Intolerance</option>
                        <option value="preference_avoid">Prefer to avoid</option>
                        <option value="clinician_elimination">Clinician-directed elimination</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!entry.emergencyMedication}
                        onChange={e => updateEntry(entry.allergenId, { emergencyMedication: e.target.checked })}
                        className="rounded border-white/20"
                      />
                      <span className="text-xs text-white/70">EpiPen / emergency medication prescribed</span>
                    </label>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Star Rating helper ────────────────────────────────────────────────────────

function StarRating({ stars, max = 5 }: { stars: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < stars ? "text-yellow-400 fill-yellow-400" : "text-white/15 fill-white/10"}`}
        />
      ))}
    </span>
  );
}

// ── Parent Education Layer Panel ──────────────────────────────────────────────

function ParentEducationPanel({ layer }: { layer: ParentEducationLayerData }) {
  const [showProtocols, setShowProtocols] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);

  return (
    <div className="space-y-3">
      {/* Confidence grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Meal Confidence */}
        <div className="col-span-2 sm:col-span-1 rounded-xl bg-black/40 border border-white/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Meal Confidence</p>
          </div>
          <StarRating stars={layer.mealConfidence.stars} />
          <p className="text-xs text-white/40">
            Profile completeness: {layer.mealConfidence.profileCompleteness}%
          </p>
          <div className="space-y-0.5">
            {layer.mealConfidence.fieldsUsed.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                <CheckCircle2 className="h-2.5 w-2.5 text-purple-400/70 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Personalization Level */}
        <div className="col-span-2 sm:col-span-1 rounded-xl bg-black/40 border border-white/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Personalization</p>
          </div>
          <StarRating stars={layer.personalizationLevel.stars} />
          <p className="text-xs text-white/40">Dimensions shaping this meal:</p>
          <div className="space-y-0.5">
            {layer.personalizationLevel.dimensionsUsed.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-400/70 flex-shrink-0" />
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clinical Review Status */}
      <div>
        <button
          type="button"
          onClick={() => setShowProtocols(!showProtocols)}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          <FlaskConical className="h-3 w-3" />
          {showProtocols ? "Hide" : "Show"} clinical review status ({layer.clinicalReviewStatus.length} protocol{layer.clinicalReviewStatus.length !== 1 ? "s" : ""} active)
        </button>
        {showProtocols && (
          <div className="mt-2 space-y-2">
            {layer.clinicalReviewStatus.map((p, i) => (
              <div key={i} className="px-3 py-2.5 rounded-lg bg-blue-950/20 border border-blue-400/15 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-blue-300/70">{p.protocolId}</span>
                  <span className="text-[10px] text-white/30">{p.version}</span>
                </div>
                <p className="text-xs text-blue-200/80">{p.status}</p>
                <div className="space-y-0.5 pt-0.5">
                  {p.sources.map((s, j) => (
                    <p key={j} className="text-[10px] text-white/30 leading-snug">• {s}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflict Resolutions */}
      {layer.conflictResolutions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowConflicts(!showConflicts)}
            className="flex items-center gap-1.5 text-xs text-amber-400/50 hover:text-amber-300/70 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            {showConflicts ? "Hide" : "Show"} protocol notes ({layer.conflictResolutions.length})
          </button>
          {showConflicts && (
            <div className="mt-2 space-y-2">
              {layer.conflictResolutions.map((c, i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg bg-amber-950/20 border border-amber-400/15 space-y-1">
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono text-amber-300/50">
                    <span>{c.protocol1}</span>
                    <span className="text-white/20">+</span>
                    <span>{c.protocol2}</span>
                  </div>
                  <p className="text-xs text-amber-200/80">{c.resolution}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mandatory Pediatrician Disclaimer ─────────────────────────────────────────

function PediatricianDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-blue-950/30 border border-blue-400/30">
      <Stethoscope className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <p className="text-xs font-semibold text-blue-300">Always Consult Your Pediatrician</p>
        <p className="text-xs text-white/60 leading-relaxed">
          My Perfect Beginning generates general nutrition-improvement ideas based on age-stage guidelines
          and the profile information you've provided. It does not replace individualized advice from your
          child's pediatrician or registered dietitian. Always consult your child's healthcare provider
          before introducing new foods, making significant dietary changes, or if you have any concerns
          about your child's growth or nutrition.
        </p>
      </div>
    </div>
  );
}

// ── Recipe Display ────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  hasEpiPen,
  educationLayer,
}: {
  recipe: ChildRecipeResponse;
  hasEpiPen: boolean;
  educationLayer: ParentEducationLayerData | null;
}) {
  const [showLog, setShowLog] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* EpiPen reminder */}
      {hasEpiPen && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-400/40">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-200 leading-relaxed">
            <strong>EpiPen reminder:</strong> Your child has an emergency medication prescribed for a severe allergy.
            Always have it on hand when introducing new foods or eating away from home.
          </p>
        </div>
      )}

      {/* Allergen alerts */}
      {recipe.allergenAlerts?.length > 0 && (
        <div className="space-y-1.5">
          {recipe.allergenAlerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-400/20">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recipe header */}
      <Card className="bg-black/40 border-green-400/20 backdrop-blur-lg">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-start gap-2">
            <Utensils className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">{recipe.recipeName}</h2>
              <p className="text-xs text-green-300 mt-0.5">{recipe.ageStageSuitability}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-white">Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-white/40 text-xs mt-0.5 w-4 text-right flex-shrink-0">{i + 1}.</span>
              <div>
                <span className="text-sm text-white">
                  {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""} {ing.name}
                </span>
                {ing.prepNote && (
                  <span className="text-xs text-white/50"> — {ing.prepNote}</span>
                )}
                {ing.substitutionNote && (
                  <p className="text-xs text-blue-300/80 mt-0.5">{ing.substitutionNote}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Texture & choking safety */}
      <Card className="bg-amber-950/20 border-amber-400/20 backdrop-blur-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">Texture & Choking Safety</p>
              <p className="text-sm text-white/80 leading-relaxed">{recipe.textureAndChokingPreparation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-white">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {recipe.instructions.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-white/80 leading-relaxed">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Serving guidance */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Serving Guidance</p>
            <p className="text-sm text-white/80">{recipe.servingGuidance}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Pairs Well With</p>
            <p className="text-sm text-white/80">{recipe.serveSuggestion}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">🎉 Fun Presentation Idea</p>
            <p className="text-sm text-white/80">{recipe.funPresentationIdea}</p>
          </div>
          {recipe.storageAndLunchboxGuidance && (
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Storage & Lunchbox</p>
              <p className="text-sm text-white/80">{recipe.storageAndLunchboxGuidance}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Why this version is better */}
      <Card className="bg-green-950/20 border-green-400/20 backdrop-blur-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-300 mb-1">Why This Version Works</p>
              <p className="text-sm text-white/80 leading-relaxed">{recipe.whyThisVersionIsBetter}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ask pediatrician note */}
      {recipe.askPediatricianNote && (
        <Card className="bg-blue-950/20 border-blue-400/20 backdrop-blur-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-300 mb-1">Ask Your Pediatrician</p>
                <p className="text-sm text-white/80 leading-relaxed">{recipe.askPediatricianNote}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Why This Meal Was Chosen */}
      {recipe.whyThisMealWasChosen && (
        <Card className="bg-purple-950/20 border-purple-400/20 backdrop-blur-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Brain className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-300 mb-1">Why This Meal Was Chosen</p>
                <p className="text-sm text-white/80 leading-relaxed">{recipe.whyThisMealWasChosen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reasoning Trace */}
      {recipe.reasoningTrace && recipe.reasoningTrace.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowTrace(!showTrace)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <FlaskConical className="h-3 w-3" />
            {showTrace ? "Hide" : "Show"} reasoning trace ({recipe.reasoningTrace.length} rule{recipe.reasoningTrace.length !== 1 ? "s" : ""} applied)
          </button>
          {showTrace && (
            <div className="mt-2 space-y-1.5">
              {recipe.reasoningTrace.map((rule, i) => (
                <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-black/30 border border-white/5">
                  <span className="text-purple-400/60 text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <p className="text-xs text-white/60">{rule}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parent Education Layer — confidence + protocols */}
      {educationLayer && (
        <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              About This Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ParentEducationPanel layer={educationLayer} />
          </CardContent>
        </Card>
      )}

      {/* Safety rules fired */}
      {recipe.rulesFireLog && recipe.rulesFireLog.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <ShieldCheck className="h-3 w-3" />
            {showLog ? "Hide" : "Show"} safety rules applied ({recipe.rulesFireLog.length})
          </button>
          {showLog && (
            <div className="mt-2 space-y-1.5">
              {recipe.rulesFireLog.map((rule, i) => (
                <div key={i} className="px-2.5 py-1.5 rounded-md bg-black/30 border border-white/5">
                  <p className="text-xs text-white/60">
                    <span className="font-mono text-green-400/70">[{rule.ruleId}]</span>{" "}
                    {rule.description}
                    <span className="text-white/30"> — {rule.action}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mandatory pediatrician disclaimer — appears on every generated output */}
      <PediatricianDisclaimer />
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Child profile auto-load ────────────────────────────────────────────────────

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";

interface ActiveChildSummary {
  id: string;
  name: string;
  age_stage: DevelopmentalStage;
  allergies: AllergyEntry[];
}

async function fetchActiveChild(): Promise<ActiveChildSummary | null> {
  try {
    const activeId = (() => { try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; } })();
    const res = await fetch(apiUrl("/api/my-perfect-beginning/children"), {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const children: any[] = data.children ?? [];
    const found = activeId ? children.find(c => c.id === activeId) : children[0];
    if (!found) return null;
    const allergies: AllergyEntry[] = Array.isArray(found.allergies)
      ? found.allergies.filter(
          (a: any) => a && typeof a.allergenId === "string" && typeof a.severity === "string"
        )
      : [];
    return { id: found.id, name: found.name, age_stage: found.age_stage, allergies };
  } catch {
    return null;
  }
}

export default function MyPerfectBeginningCreateMealPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [selectedStage, setSelectedStage] = useState<DevelopmentalStage | "">("");
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [foodRequest, setFoodRequest] = useState("");

  // Active child from DB (pre-populate stage + allergies)
  const [activeChild, setActiveChild] = useState<ActiveChildSummary | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recipe, setRecipe] = useState<ChildRecipeResponse | null>(null);
  const [educationLayer, setEducationLayer] = useState<ParentEducationLayerData | null>(null);
  const [showEarlyInfantScreen, setShowEarlyInfantScreen] = useState(false);

  // Load active child profile on mount and pre-populate form
  useEffect(() => {
    fetchActiveChild().then(child => {
      if (child) {
        setActiveChild(child);
        setSelectedStage(child.age_stage);
        setAllergies(child.allergies);
        if (child.age_stage === "early_infant") {
          setShowEarlyInfantScreen(true);
        }
      }
      setProfileLoaded(true);
    });
  }, []);

  useEffect(() => {
    document.title = "Create a Meal | My Perfect Beginning";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Progress ticker
  useEffect(() => {
    if (!isGenerating) { setProgress(0); return; }
    const interval = window.setInterval(() => {
      setProgress(p => p < 88 ? p + Math.max(1, Math.floor((88 - p) * 0.08)) : p);
    }, 160);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!selectedStage) {
      toast({ title: "Select your child's stage", description: "Choose a developmental stage to continue.", variant: "destructive" });
      return;
    }

    // Early Infant gate (client-side, immediately)
    if (selectedStage === "early_infant") {
      setShowEarlyInfantScreen(true);
      return;
    }

    if (!foodRequest.trim()) {
      toast({ title: "What would you like to make?", description: "Enter a food or dish to get started.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setRecipe(null);
    setEducationLayer(null);

    try {
      const res = await fetch(apiUrl("/api/my-perfect-beginning/create-dish"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ageStage: selectedStage,
          allergies,
          foodRequest: foodRequest.trim(),
          childName: activeChild?.name ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate recipe");
      }

      if (data.blocked && data.blockReason === "early_infant") {
        setShowEarlyInfantScreen(true);
        return;
      }

      setProgress(100);
      setRecipe(data.recipe);
      if (data.mealConfidence && data.clinicalReviewStatus && data.personalizationLevel) {
        setEducationLayer({
          mealConfidence: data.mealConfidence,
          clinicalReviewStatus: data.clinicalReviewStatus,
          personalizationLevel: data.personalizationLevel,
          conflictResolutions: data.conflictResolutions ?? [],
        });
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasEpiPen = allergies.some(a => a.emergencyMedication);
  const stageMeta = STAGES.find(s => s.id === selectedStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black/70 via-green-900/30 to-black/80 pb-safe-nav"
    >
      {/* Header */}
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-green-400/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2">
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Baby className="h-5 w-5 text-green-400 flex-shrink-0" />
              <h1 className="text-lg font-bold text-white truncate">Create a Meal</h1>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12 space-y-5">
        {/* Tagline */}
        {!recipe && !showEarlyInfantScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pb-2"
          >
            <p className="text-white/50 text-sm leading-relaxed">
              Age-safe, kid-friendly recipes built for how your child eats — not how you do.
            </p>
          </motion.div>
        )}

        {/* Early Infant Education Screen */}
        {showEarlyInfantScreen && (
          <EarlyInfantScreen onBack={() => { setShowEarlyInfantScreen(false); setSelectedStage(""); }} />
        )}

        {/* Generated Recipe */}
        {!showEarlyInfantScreen && recipe && (
          <div className="space-y-4">
            <RecipeCard recipe={recipe} hasEpiPen={hasEpiPen} educationLayer={educationLayer} />
            <button
              type="button"
              onClick={() => { setRecipe(null); setEducationLayer(null); setFoodRequest(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="w-full py-3 rounded-xl bg-green-500/10 text-green-300 text-sm font-medium border border-green-400/20 hover:bg-green-500/20 transition-all"
            >
              Make Another Recipe
            </button>
          </div>
        )}

        {/* Input Form */}
        {!showEarlyInfantScreen && !recipe && (
          <div className="space-y-4">
            {/* Active child profile indicator */}
            {profileLoaded && activeChild && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-900/30 border border-emerald-500/25"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-sm">
                  <Baby className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-300 font-medium">
                    Using <span className="font-semibold">{activeChild.name}</span>'s profile
                  </p>
                  <p className="text-[11px] text-white/40 leading-tight">
                    Stage and allergies pre-loaded — just type what you'd like to make.
                  </p>
                </div>
                <button
                  onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
                  className="flex-shrink-0 text-[11px] text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2"
                >
                  Switch child
                </button>
              </motion.div>
            )}
            {profileLoaded && !activeChild && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                <Baby className="h-4 w-4 text-white/30 flex-shrink-0" />
                <p className="text-xs text-white/40 flex-1">
                  No child profile selected.{" "}
                  <button
                    onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
                    className="text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2"
                  >
                    Add one
                  </button>
                  {" "}to save allergies and stage for next time.
                </p>
              </div>
            )}

            {/* Stage selector */}
            <Card className="bg-black/40 border-green-400/20 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Baby className="h-4 w-4 text-green-400" />
                  Your child's developmental stage
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {STAGES.map(stage => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        setSelectedStage(stage.id);
                        if (stage.id === "early_infant") setShowEarlyInfantScreen(true);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        selectedStage === stage.id
                          ? "bg-green-500/15 border-green-400/40 text-white"
                          : "bg-black/20 border-white/10 text-white/60 hover:border-white/25 hover:text-white/80"
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{stage.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block">{stage.label}</span>
                        <span className="text-xs text-white/40">{stage.ageRange}</span>
                      </div>
                      {stage.id === "early_infant" && (
                        <span className="text-[10px] text-blue-300/70 flex-shrink-0">Education only</span>
                      )}
                    </button>
                  ))}
                </div>

                {stageMeta && selectedStage !== "early_infant" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 px-2 py-1.5 rounded-md bg-green-500/10 border border-green-400/15"
                  >
                    <p className="text-xs text-green-300">
                      ✓ Stage confirmed: <strong>{stageMeta.label}</strong> ({stageMeta.ageRange})
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Age ranges are approximate — developmental readiness is what matters most.
                    </p>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Allergen selector */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-red-400" />
                  Allergies & intolerances
                  <span className="text-xs font-normal text-white/40 ml-1">(optional)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <AllergenSelector allergies={allergies} onChange={setAllergies} />
                {allergies.length === 0 && (
                  <p className="text-xs text-white/30 mt-2">Tap an allergen above to add it. You can set severity and EpiPen status for each.</p>
                )}
              </CardContent>
            </Card>

            {/* Food request */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-400" />
                  What would you like to make?
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <textarea
                  value={foodRequest}
                  onChange={e => setFoodRequest(e.target.value)}
                  placeholder="e.g. Mac and cheese, chicken nuggets, banana pancakes, spaghetti…"
                  className="w-full px-3 py-2 bg-black text-white placeholder:text-white/30 border border-white/10 rounded-lg h-20 resize-none text-sm focus:outline-none focus:border-green-400/40"
                  maxLength={200}
                />
                <p className="text-xs text-white/30 text-right">{foodRequest.length}/200</p>
              </CardContent>
            </Card>

            {/* Progress bar while generating */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-white/10" />
                <p className="text-center text-xs text-white/50 flex items-center justify-center gap-1">
                  Building your kid-friendly recipe <ThinkingDots />
                </p>
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !selectedStage}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm shadow-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isGenerating ? "Creating Recipe…" : "Create Kid-Friendly Recipe"}
            </button>

            {/* Disclaimer */}
            <p className="text-center text-xs text-white/25 leading-relaxed px-4">
              My Perfect Beginning generates general nutrition-improvement ideas for healthy children.
              It does not replace advice from your child's pediatrician or registered dietitian.
              Always consult your child's healthcare provider before introducing new foods or making dietary changes.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
