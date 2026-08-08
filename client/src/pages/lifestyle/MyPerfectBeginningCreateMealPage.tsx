import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/apiRequest";
import { post, get } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Baby,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Utensils,
  Info,
  Star,
  FlaskConical,
  Brain,
  Stethoscope,
  Clock,
  Users,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThinkingDots from "@/components/ThinkingDots";
import { Progress } from "@/components/ui/progress";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import FavoriteButton from "@/components/FavoriteButton";
import TrashButton from "@/components/ui/TrashButton";
import TranslateToggle from "@/components/TranslateToggle";
import { GlassButton } from "@/components/glass";

// ── Types ────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

interface ParentPrefs {
  budgetLevel?: string;
  maxCookTimeMinutes?: number;
  requiresSchoolSafe?: boolean;
  requiresPackable?: boolean;
  culturalCuisine?: string;
  dietaryPattern?: string;
  goals?: string[];
}

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

interface CompletePlateSide {
  name: string;
  category: "fruit" | "vegetable" | "grain" | "dairy" | "protein";
  servingSize: string;
  prepNote: string;
  nutritionalRole: string;
  allergenFree?: boolean;
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
  estimatedCarbsPerServing?: string;
  rulesFireLog?: RuleFiredEntry[];
  // Parent Education Layer — AI-generated
  whyThisMealWasChosen?: string;
  reasoningTrace?: string[];
  // Complete the Plate — AI-generated sides
  completePlate?: CompletePlate;
}

interface ClinicalDRI {
  kcalRange: string;
  proteinRange: string;
  ironMg: number;
  calciumMg: number;
  sodiumMgMax: number;
  addedSugarGMax: number;
}
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

// ── Resolver metadata — server-computed, drives "Why the engine decided" panel ──

interface ResolverFiredRule {
  ruleId: string;
  level: "A" | "B" | "C";
  description: string;
  action: string;
}

interface ResolverProtocolBlock {
  conditionId: string;
  conditionLabel: string;
  optimizations: string[];
}

interface ResolverAllergenRemoval {
  allergenId: string;
  displayName: string;
  action: string;
  severity: string;
  emergencyMedication: boolean;
}

interface ResolverFoodAcceptanceDirective {
  type: string;
  description: string;
  items: string[];
}

interface ResolverConflictResolution {
  ruleA: string;
  ruleB: string;
  resolution: string;
  winner: string;
}

interface ResolverMetaEnhanced {
  firedRules?: ResolverFiredRule[];
  activeProtocolBlocks?: ResolverProtocolBlock[];
  allergenRemovals?: ResolverAllergenRemoval[];
  foodAcceptanceDirectives?: ResolverFoodAcceptanceDirective[];
  preferencesUsed?: {
    culturalCuisine: string | null;
    dietaryPattern: string | null;
    goals: string[];
  };
  conflictResolutions?: ResolverConflictResolution[];
  stageDRIBaseline?: {
    stageLabel: string;
    ironMg: number;
    calciumMg: number;
    vitaminDIU: number;
    honeyAllowed: boolean;
  };
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
              <p className="text-xs text-white mt-0.5">Birth to ~5 months</p>
            </div>
          </div>

          <p className="text-sm text-white leading-relaxed">
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
                <li key={sign} className="flex items-start gap-2 text-sm text-white">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  {sign}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/20">
            <p className="text-xs text-blue-200 font-medium mb-1">Questions to ask your pediatrician</p>
            <ul className="space-y-1 text-xs text-white">
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

      <p className="text-center text-xs text-white">
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

// ── Hard-Stop Screen (PKU, G-tube, and any future clinical gate) ──────────────

function HardStopScreen({
  blockReason,
  educationMessage,
  onBack,
}: {
  blockReason: string;
  educationMessage: string;
  onBack: () => void;
}) {
  const reasonLabel: Record<string, string> = {
    pku:    "Phenylketonuria (PKU)",
    g_tube: "G-Tube / Enteral Nutrition",
  };
  const title = reasonLabel[blockReason] ?? "Specialist Nutrition Required";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="bg-amber-950/40 border-amber-400/30 backdrop-blur-lg">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-amber-500/20 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <p className="text-xs text-white mt-0.5">Requires specialist guidance</p>
            </div>
          </div>

          <p className="text-sm text-white leading-relaxed">{educationMessage}</p>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/20">
            <p className="text-xs text-amber-200 font-medium mb-1">Next steps</p>
            <ul className="space-y-1 text-xs text-white">
              <li>• Speak with your child's pediatrician or registered dietitian</li>
              <li>• Bring this profile to your next clinical appointment</li>
              <li>• Ask your care team for a safe food list specific to your child</li>
            </ul>
          </div>
        </CardContent>
      </Card>

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
                  : "bg-black/30 border-white/15 text-white hover:border-white/30 hover:text-white"
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
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-white"
                >
                  <span className="font-medium">
                    {meta.emoji} {meta.label} — {SEVERITY_LABELS[entry.severity]}
                  </span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <div>
                      <label className="block text-xs text-white mb-1">Severity</label>
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
                      <span className="text-xs text-white">EpiPen / emergency medication prescribed</span>
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

function formatTextureClass(tc: string | undefined): string {
  if (!tc) return "Age-Safe";
  const map: Record<string, string> = {
    smooth_puree:    "Smooth Purée",
    thin_puree:      "Thin Purée",
    thick_puree:     "Thick Purée",
    mashed:          "Mashed",
    soft_lumpy:      "Soft Lumpy",
    soft_chopped:    "Soft Chopped",
    fork_tender:     "Fork Tender",
    small_soft_bite: "Small Soft Bites",
    table_foods:     "Table Foods",
    family_foods:    "Regular Table Foods",
    family_table:    "Regular Table Foods",
    family:          "Regular Table Foods",
    minced:          "Minced",
  };
  return map[tc] ?? tc.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Why the Engine Made These Decisions Panel ─────────────────────────────────
// Plain-language explanations for parents — no technical IDs, no jargon.

function stripTechIds(text: string): string {
  // Remove leading COND-XXXX and RULE-XXXX references and outer parens
  return text
    .replace(/^(COND|RULE)-\d{4}\s*/i, "")
    .replace(/^Allergen\s+HARD STOP\s+on\s+/i, "")
    .replace(/^\(/, "").replace(/\)$/, "")
    .trim();
}

function allergenActionLabel(action: string, severity: string): string {
  if (action === "HARD_STOP") return "Completely removed — confirmed allergy";
  if (action === "SOFT_BLOCK") return "Removed — suspected reaction";
  if (action === "EXCLUDE") return "Excluded — intolerance";
  return "Avoided — parent preference";
}

interface WhyEngineDecidedPanelProps {
  resolverMeta: ResolverMetaEnhanced | null;
  conflictResolutions?: ConflictResolution[];
}

function WhyEngineDecidedPanel({ resolverMeta, conflictResolutions }: WhyEngineDecidedPanelProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const safetyRules = resolverMeta?.firedRules?.filter(r => r.level === "A") ?? [];
  const nutritionRules = resolverMeta?.firedRules?.filter(r => r.level === "B") ?? [];
  const allergenRemovals = resolverMeta?.allergenRemovals ?? [];
  const medicalConditions = resolverMeta?.activeProtocolBlocks ?? [];
  const prefs = resolverMeta?.preferencesUsed;
  const foodDirectives = resolverMeta?.foodAcceptanceDirectives ?? [];
  const resolverConflicts = resolverMeta?.conflictResolutions ?? [];
  const legacyConflicts = conflictResolutions ?? [];

  // Build child-preferences list
  const preferenceItems: string[] = [];
  if (prefs?.culturalCuisine) preferenceItems.push(`${prefs.culturalCuisine} cuisine preferred`);
  if (prefs?.dietaryPattern && prefs.dietaryPattern !== "omnivore") {
    preferenceItems.push(prefs.dietaryPattern.replace(/_/g, " ") + " diet");
  }
  for (const g of prefs?.goals ?? []) preferenceItems.push(g);
  for (const dir of foodDirectives) {
    if (dir.type === "avoid_dislike" && dir.items.length > 0) {
      for (const item of dir.items) preferenceItems.push(`Avoids ${item}`);
    }
  }

  // Merge conflicts (prefer resolver ones since they're more specific)
  const allConflicts: Array<{ labelA: string; labelB: string; resolution: string }> = [
    ...resolverConflicts.map(c => ({
      labelA: stripTechIds(c.ruleA),
      labelB: stripTechIds(c.ruleB),
      resolution: c.resolution,
    })),
    // Only add legacy ones that aren't already covered
    ...(resolverConflicts.length === 0
      ? legacyConflicts.map(c => ({
          labelA: c.protocol1,
          labelB: c.protocol2,
          resolution: c.resolution,
        }))
      : []),
  ];

  const hasAnyContent =
    safetyRules.length > 0 ||
    allergenRemovals.length > 0 ||
    nutritionRules.length > 0 ||
    medicalConditions.length > 0 ||
    preferenceItems.length > 0 ||
    allConflicts.length > 0;

  if (!hasAnyContent) return null;

  const sections: Array<{
    id: string;
    icon: React.ReactNode;
    title: string;
    count: number;
    color: string;
    content: React.ReactNode;
  }> = [];

  // 1. Safety Rules Applied
  if (safetyRules.length > 0 || allergenRemovals.length > 0) {
    sections.push({
      id: "safety",
      icon: <ShieldCheck className="h-3.5 w-3.5 text-red-400" />,
      title: "Safety Rules Applied",
      count: safetyRules.length + allergenRemovals.length,
      color: "text-red-300",
      content: (
        <div className="space-y-2">
          {allergenRemovals.map((a, i) => (
            <div key={`a-${i}`} className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5 flex-shrink-0 text-base leading-none">🚫</span>
              <div>
                <p className="text-xs text-white font-medium capitalize">
                  {a.displayName.replace(/_/g, " ")} removed
                </p>
                <p className="text-xs text-white mt-0.5">{allergenActionLabel(a.action, a.severity)}</p>
              </div>
            </div>
          ))}
          {safetyRules.map((r, i) => (
            <div key={`r-${i}`} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-red-400/70 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white leading-relaxed">{r.description}</p>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 2. Nutrition Rules Applied
  const nutritionItems: string[] = [
    ...nutritionRules.map(r => r.description),
    ...medicalConditions.flatMap(b => b.optimizations.slice(0, 2)),
  ];
  if (nutritionItems.length > 0) {
    const dri = resolverMeta?.stageDRIBaseline;
    sections.push({
      id: "nutrition",
      icon: <Sparkles className="h-3.5 w-3.5 text-green-400" />,
      title: "Nutrition Rules Applied",
      count: nutritionItems.length,
      color: "text-green-300",
      content: (
        <div className="space-y-2">
          {dri && (
            <div className="px-2.5 py-2 rounded-lg bg-green-950/30 border border-green-400/15 mb-1">
              <p className="text-xs text-green-300/80 font-medium mb-1">{dri.stageLabel}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {dri.ironMg > 0 && <span className="text-[11px] text-white">Iron target: {dri.ironMg}mg</span>}
                {dri.calciumMg > 0 && <span className="text-[11px] text-white">Calcium: {dri.calciumMg}mg</span>}
                {dri.vitaminDIU > 0 && <span className="text-[11px] text-white">Vitamin D: {dri.vitaminDIU}IU</span>}
              </div>
            </div>
          )}
          {nutritionItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 3. Child Preferences Used
  if (preferenceItems.length > 0) {
    sections.push({
      id: "preferences",
      icon: <Star className="h-3.5 w-3.5 text-yellow-400" />,
      title: "Child Preferences Used",
      count: preferenceItems.length,
      color: "text-yellow-300",
      content: (
        <div className="space-y-1.5">
          {preferenceItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400/70 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white leading-relaxed capitalize-first">{item}</p>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 4. Medical Conditions Considered
  if (medicalConditions.length > 0) {
    sections.push({
      id: "conditions",
      icon: <Stethoscope className="h-3.5 w-3.5 text-purple-400" />,
      title: "Medical Conditions Considered",
      count: medicalConditions.length,
      color: "text-purple-300",
      content: (
        <div className="space-y-1.5">
          {medicalConditions.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-950/30 border border-purple-400/15">
              <Brain className="h-3 w-3 text-purple-400 flex-shrink-0" />
              <p className="text-xs text-purple-200/90 font-medium">{b.conditionLabel}</p>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 5. Rule Conflicts Resolved
  if (allConflicts.length > 0) {
    sections.push({
      id: "conflicts",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
      title: "Rule Conflicts Resolved",
      count: allConflicts.length,
      color: "text-amber-300",
      content: (
        <div className="space-y-3">
          {allConflicts.map((c, i) => (
            <div key={i} className="rounded-lg bg-amber-950/25 border border-amber-400/15 p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-white">
                <span className="bg-amber-500/15 text-amber-200/80 px-1.5 py-0.5 rounded text-[10px] font-medium">{c.labelA}</span>
                <span className="text-white">vs.</span>
                <span className="bg-amber-500/15 text-amber-200/80 px-1.5 py-0.5 rounded text-[10px] font-medium">{c.labelB}</span>
              </div>
              <p className="text-xs text-amber-100/80 leading-relaxed">✓ {c.resolution}</p>
            </div>
          ))}
        </div>
      ),
    });
  }

  return (
    <div className="space-y-1.5">
      {sections.map(section => (
        <div key={section.id} className="rounded-xl border border-white/8 bg-black/20 overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(section.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              {section.icon}
              <span className={`text-xs font-semibold ${section.color}`}>{section.title}</span>
              <span className="text-[10px] text-white bg-white/5 px-1.5 py-0.5 rounded-full">
                {section.count}
              </span>
            </div>
            {openSection === section.id
              ? <ChevronUp className="h-3.5 w-3.5 text-white" />
              : <ChevronDown className="h-3.5 w-3.5 text-white" />
            }
          </button>
          {openSection === section.id && (
            <div className="px-4 pb-4 pt-1">
              {section.content}
            </div>
          )}
        </div>
      ))}
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
        <p className="text-xs text-white leading-relaxed">
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

function NutritionBadgeRow({ badges }: { badges: string[] }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">What this meal provides</p>
      <div className="flex flex-wrap gap-2">
        {badges.map(badge => {
          const cfg = BADGE_CONFIG[badge] ?? { emoji: "✅", pill: "bg-white/5 border-white/15 text-white/60" };
          return (
            <span
              key={badge}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.pill}`}
            >
              <span aria-hidden="true">{cfg.emoji}</span>
              {badge}
            </span>
          );
        })}
      </div>
    </div>
  );
}
function ParentEducationPanel({ layer }: { layer: ParentEducationLayerData }) {
  const starsFilled = layer.mealConfidence.stars ?? 0;
  const completeness = layer.mealConfidence.profileCompleteness;
  const dimsUsed = layer.personalizationLevel.dimensionsUsed ?? [];
  const reviews = layer.clinicalReviewStatus ?? [];

  return (
    <div className="space-y-3">
      {/* Personalization dimensions */}
      {dimsUsed.length > 0 && (
        <div>
          <p className="text-xs text-white mb-1">Personalized for</p>
          <div className="flex flex-wrap gap-1">
            {dimsUsed.map((dim, i) => (
              <span key={i} className="text-[10px] bg-purple-500/15 text-purple-300/80 border border-purple-400/15 rounded-full px-2 py-0.5">
                {dim}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clinical review status */}
      {reviews.length > 0 && (
        <div>
          {reviews.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-white">
              <CheckCircle2 className="h-3 w-3 text-green-400/70 flex-shrink-0" />
              <span className="text-green-300/70 font-medium">{r.status}</span>
              <span>— {r.protocolId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  fruit:     { emoji: "🍎", label: "Fruit",     color: "text-red-300 bg-red-950/30 border-red-400/20" },
  vegetable: { emoji: "🥦", label: "Vegetable", color: "text-green-300 bg-green-950/30 border-green-400/20" },
  grain:     { emoji: "🌾", label: "Grain",     color: "text-amber-300 bg-amber-950/30 border-amber-400/20" },
  dairy:     { emoji: "🥛", label: "Dairy",     color: "text-blue-300 bg-blue-950/30 border-blue-400/20" },
  protein:   { emoji: "🥚", label: "Protein",   color: "text-purple-300 bg-purple-950/30 border-purple-400/20" },
};
function RecipeCard({
  recipe,
  hasEpiPen,
  educationLayer,
  resolverMeta,
  stageLabel,
  textureClass,
  imageUrl,
  imageLoading,
  onDelete,
  onUpdateRecipe,
  setLocation,
  nutritionBadges,
  clinicalNutritionSummary,
  ageStage,
  allergies,
  parentPrefs,
}: {
  recipe: ChildRecipeResponse;
  hasEpiPen: boolean;
  educationLayer: ParentEducationLayerData | null;
  resolverMeta: ResolverMetaEnhanced | null;
  stageLabel: string;
  textureClass?: string;
  imageUrl: string | null;
  imageLoading: boolean;
  nutritionBadges: string[];
  clinicalNutritionSummary: ClinicalNutritionSummary | null;
  onDelete: () => void;
  onUpdateRecipe: (updated: Partial<ChildRecipeResponse>) => void;
  setLocation: (path: string) => void;
  ageStage: DevelopmentalStage | "";
  allergies: AllergyEntry[];
  parentPrefs?: ParentPrefs;
}) {
  const [showLog, setShowLog] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(true);

  // Confidence % from education layer
  const confidencePct = educationLayer?.mealConfidence.profileCompleteness
    ? `${educationLayer.mealConfidence.profileCompleteness}%`
    : educationLayer?.mealConfidence.stars
      ? `${Math.round((educationLayer.mealConfidence.stars / 5) * 100)}%`
      : "—";

  // Clinical review from education layer
  const clinicalStatus = educationLayer?.clinicalReviewStatus?.[0]?.status ?? "Reviewed";

  const steps = recipe.instructions;
  const visibleSteps = stepsExpanded ? steps : steps.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* ── Main card ── */}
      <Card className="bg-black/40 backdrop-blur-lg border border-green-400/20 shadow-xl rounded-2xl">
        <CardContent className="p-6">

          {/* Header row: name + favorite + new recipe */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-5 w-5 text-green-400 shrink-0" />
              <h3 className="text-xl font-bold text-white truncate leading-tight flex-1 min-w-0">
                {recipe.recipeName}
              </h3>
            </div>
            <div className="flex items-center justify-between">
              <FavoriteButton
                title={recipe.recipeName}
                sourceType="pediatric-recipe"
                mealData={{
                  id: `ped-${Date.now()}`,
                  name: recipe.recipeName,
                  description: recipe.ageStageSuitability,
                  ingredients: recipe.ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
                  instructions: recipe.instructions.join("\n"),
                  imageUrl: imageUrl ?? undefined,
                }}
              />
              <button
                onClick={onDelete}
                className="text-sm text-white bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
              >
                New Recipe
              </button>
            </div>
          </div>

          {/* EpiPen reminder */}
          {hasEpiPen && (
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-400/40">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-200 leading-relaxed">
                <strong>EpiPen reminder:</strong> Your child has emergency medication prescribed for a severe allergy.
                Always have it on hand when introducing new foods or eating away from home.
              </p>
            </div>
          )}

          {/* Allergen safety badges */}
          {recipe.allergenAlerts?.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {recipe.allergenAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-400/20">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200">{alert.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* DALL·E image with shimmer */}
          {(imageUrl || imageLoading) && (
            <div className="mb-4">
              <MealImageSlot
                imageUrl={imageUrl ?? undefined}
                mealName={recipe.recipeName}
                isLoading={imageLoading}
                sourceType="meal"
                height="h-56"
                className="rounded-2xl overflow-hidden"
              />
            </div>
          )}

          {/* Age stage caption */}
          <p className="text-white text-sm mb-4">{recipe.ageStageSuitability}</p>

          {/* Pediatric info tiles */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-green-300 leading-tight">{stageLabel.split(" ").slice(0, 1).join("")}</div>
              <div className="text-[10px] text-white mt-0.5">Age Group</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-amber-300 leading-tight truncate">{formatTextureClass(textureClass).split(" ").slice(0, 2).join(" ")}</div>
              <div className="text-[10px] text-white mt-0.5">Texture</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-blue-300 leading-tight truncate">✓</div>
              <div className="text-[10px] text-white mt-0.5">Safety Applied</div>
            </div>
          </div>

          {/* Nutrient badge row — parent-friendly, no grams */}
          {nutritionBadges.length > 0 && (
            <div className="mb-4">
              <NutritionBadgeRow badges={nutritionBadges} />
            </div>
          )}

          {/* Clinical Details — collapsed by default, for physicians */}
          {clinicalNutritionSummary && (
            <div className="mb-4">
              <ClinicalDetailsPanel summary={clinicalNutritionSummary} />
            </div>
          )}

          {/* Texture & choking safety — prominent safety section */}
          <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-950/25 border border-amber-400/25">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-0.5">Texture & Choking Safety</p>
              <p className="text-xs text-white leading-relaxed">{recipe.textureAndChokingPreparation}</p>
            </div>
          </div>

          {/* Ingredients */}
          {recipe.ingredients.length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setIngredientsExpanded(v => !v)}
                className="flex items-center gap-2 font-semibold mb-2 text-white w-full text-left"
              >
                <span>Ingredients</span>
                {ingredientsExpanded
                  ? <ChevronUp className="h-4 w-4 text-white" />
                  : <ChevronDown className="h-4 w-4 text-white" />}
              </button>
              {ingredientsExpanded && (
                <ul className="text-sm text-white space-y-1.5">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                      <span>
                        {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""} <strong>{ing.name}</strong>
                        {ing.prepNote && (
                          <span className="block text-xs text-white/70 mt-0.5">{ing.prepNote}</span>
                        )}
                        {ing.substitutionNote && (
                          <span className="block text-xs text-blue-300/80 mt-0.5">{ing.substitutionNote}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Instructions with tap-to-highlight */}
          {steps.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2 text-white">Instructions:</h4>
              <div className="space-y-2">
                {visibleSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${
                      activeStep === index
                        ? "bg-green-500/20 border border-green-500/40"
                        : "hover:bg-white/5"
                    }`}
                    onClick={() => setActiveStep(prev => prev === index ? null : index)}
                  >
                    <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-white">{step}</p>
                  </div>
                ))}
              </div>
              {steps.length > 3 && (
                <button
                  className="mt-2 text-xs text-green-400 font-medium cursor-pointer active:text-green-300 select-none"
                  onClick={() => {
                    setStepsExpanded(v => !v);
                    if (stepsExpanded) setActiveStep(null);
                  }}
                >
                  {stepsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                </button>
              )}
            </div>
          )}

          {/* Serving guidance, fun presentation, storage */}
          <div className="mb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">Serving Guidance</p>
              <p className="text-sm text-white">{recipe.servingGuidance}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">Pairs Well With</p>
              <p className="text-sm text-white">{recipe.serveSuggestion}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">🎉 Fun Presentation Idea</p>
              <p className="text-sm text-white">{recipe.funPresentationIdea}</p>
            </div>
            {recipe.storageAndLunchboxGuidance && (
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">Storage & Lunchbox</p>
                <p className="text-sm text-white">{recipe.storageAndLunchboxGuidance}</p>
              </div>
            )}
          </div>

          {/* Why this version works */}
          {recipe.whyThisVersionIsBetter && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Why This Version Works for Your Child:
              </h4>
              <p className="text-sm text-white">{recipe.whyThisVersionIsBetter}</p>
            </div>
          )}

          {/* Why this meal was chosen */}
          {recipe.whyThisMealWasChosen && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                <Brain className="h-4 w-4 text-purple-400" />
                Why This Meal Was Chosen:
              </h4>
              <p className="text-sm text-white">{recipe.whyThisMealWasChosen}</p>
            </div>
          )}

          {/* Ask pediatrician note */}
          {recipe.askPediatricianNote && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-blue-950/25 border border-blue-400/20">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-300 mb-0.5">Ask Your Pediatrician</p>
                <p className="text-xs text-white leading-relaxed">{recipe.askPediatricianNote}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 mt-2">
            {/* Walk Through the Kitchen */}
            <div className="grid grid-cols-2 gap-2">
              <GlassButton
                onClick={() => {
                  const mealData = {
                    id: `ped-${Date.now()}`,
                    name: recipe.recipeName,
                    description: recipe.ageStageSuitability,
                    ingredients: recipe.ingredients.map(i => ({
                      name: i.name,
                      amount: i.quantity,
                      unit: i.unit ?? "",
                    })),
                    instructions: recipe.instructions.join("\n"),
                    imageUrl: imageUrl ?? undefined,
                  };
                  localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
                  localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
                  localStorage.setItem("mpm_chefs_kitchen_origin", window.location.pathname);
                  setLocation("/lifestyle/chefs-kitchen");
                }}
                className="flex-1 bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 hover:from-green-600 hover:via-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                Walk Through Kitchen
              </GlassButton>
              <TranslateToggle
                content={{
                  name: recipe.recipeName,
                  description: recipe.ageStageSuitability,
                  instructions: recipe.instructions.join("\n"),
                  ingredients: recipe.ingredients.map(i => ({
                    name: i.name,
                    amount: i.quantity,
                    unit: i.unit,
                  })),
                }}
                onTranslate={(translated) => {
                  onUpdateRecipe({
                    recipeName: translated.name ?? recipe.recipeName,
                    ageStageSuitability: translated.description ?? recipe.ageStageSuitability,
                    instructions: typeof translated.instructions === "string"
                      ? translated.instructions.split("\n").filter(Boolean)
                      : recipe.instructions,
                  });
                }}
              />
            </div>

            {/* Delete button */}
            <div className="flex justify-end pt-1">
              <TrashButton
                size="sm"
                ariaLabel="Delete recipe"
                title="Delete recipe"
                confirm={true}
                confirmMessage="Remove this recipe?"
                onClick={onDelete}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complete the Plate — sides section */}
      {recipe.completePlate && recipe.completePlate.sides && recipe.completePlate.sides.length > 0 && (
        <CompleteThePlateSection
          completePlate={recipe.completePlate}
          ageStage={ageStage}
          allergies={allergies}
          parentPrefs={parentPrefs}
        />
      )}

      {/* Debug / transparency panels — collapsed by default */}
      <div className="space-y-2">
        {/* About this recommendation (education layer) */}
        {educationLayer && (
          <Card className="bg-black/30 border-white/8 backdrop-blur-lg">
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

        {/* Reasoning trace */}
        {recipe.reasoningTrace && recipe.reasoningTrace.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTrace(!showTrace)}
              className="flex items-center gap-1.5 text-xs text-white hover:text-white transition-colors"
            >
              <FlaskConical className="h-3 w-3" />
              {showTrace ? "Hide" : "Show"} reasoning trace ({recipe.reasoningTrace.length} rule{recipe.reasoningTrace.length !== 1 ? "s" : ""} applied)
            </button>
            {showTrace && (
              <div className="mt-2 space-y-1.5">
                {recipe.reasoningTrace.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-black/30 border border-white/5">
                    <span className="text-purple-400/60 text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <p className="text-xs text-white">{rule}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Safety rules applied */}
        {recipe.rulesFireLog && recipe.rulesFireLog.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowLog(!showLog)}
              className="flex items-center gap-1.5 text-xs text-white hover:text-white transition-colors"
            >
              <ShieldCheck className="h-3 w-3" />
              {showLog ? "Hide" : "Show"} safety rules applied ({recipe.rulesFireLog.length})
            </button>
            {showLog && (
              <div className="mt-2 space-y-1.5">
                {recipe.rulesFireLog.map((rule, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-md bg-black/30 border border-white/5">
                    <p className="text-xs text-white">
                      <span className="font-mono text-green-400/70">[{rule.ruleId}]</span>{" "}
                      {rule.description}
                      <span className="text-white"> — {rule.action}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Why the Engine Made These Decisions — plain-language panel */}
        {(resolverMeta || educationLayer) && (
          <Card className="bg-black/30 border-white/8 backdrop-blur-lg">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                Why the Engine Made These Decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <WhyEngineDecidedPanel
                resolverMeta={resolverMeta}
                conflictResolutions={educationLayer?.conflictResolutions}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pediatrician disclaimer — show generic version only when no personalized note from the AI */}
      {!recipe.askPediatricianNote && <PediatricianDisclaimer />}
    </motion.div>
  );
}
// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Child profile auto-load ────────────────────────────────────────────────────

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";
const LS_MEAL_OPTIONS_KEY  = "mpb.mealOptions.v1";

function saveMealOptionsCache(options: any[]) {
  try { localStorage.setItem(LS_MEAL_OPTIONS_KEY, JSON.stringify(options)); } catch {}
}
function loadMealOptionsCache(): any[] {
  try {
    const raw = localStorage.getItem(LS_MEAL_OPTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function clearMealOptionsCache() {
  try { localStorage.removeItem(LS_MEAL_OPTIONS_KEY); } catch {}
}

interface ActiveChildSummary {
  id: string;
  name: string;
  age_stage: DevelopmentalStage;
  allergies: AllergyEntry[];
}

interface ChildListItem {
  id: string;
  name: string;
  age_stage: DevelopmentalStage;
  date_of_birth: string | null;
  emoji: string;
  allergies: any[];
  medical_conditions: any[];
}

function getStoredActiveId(): string | null {
  try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; }
}

function stageAgeLabel(child: ChildListItem): string {
  if (child.date_of_birth) {
    const dob = new Date(child.date_of_birth);
    const now = new Date();
    const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (months < 24) return `${months} mo`;
    const years = Math.floor(months / 12);
    return `${years}`;
  }
  const stageMap: Record<string, string> = {
    early_infant: "0–5 mo",
    beginning_foods: "6–11 mo",
    young_toddler: "1–2 yr",
    toddler: "2–3 yr",
    preschool: "4–5 yr",
    early_school_age: "6–8 yr",
    growing_child: "9–12 yr",
  };
  return stageMap[child.age_stage] ?? child.age_stage;
}

function toActiveSummary(child: ChildListItem): ActiveChildSummary {
  const allergies: AllergyEntry[] = Array.isArray(child.allergies)
    ? child.allergies.filter(
        (a: any) => a && typeof a.allergenId === "string" && typeof a.severity === "string"
      )
    : [];
  return { id: child.id, name: child.name, age_stage: child.age_stage, allergies };
}

async function fetchAllChildren(): Promise<ChildListItem[]> {
  try {
    const data = await apiRequest(apiUrl("/api/my-perfect-beginning/children"));
    return data.children ?? [];
  } catch {
    return [];
  }
}

type CookingMode = "one_child" | "multiple_children" | "entire_family";
function ChildPickerSheet({
  children,
  onSelectSingle,
  onSelectMultiple,
  onGeneral,
}: {
  children: ChildListItem[];
  onSelectSingle: (child: ChildListItem) => void;
  onSelectMultiple: (ids: string[], mode: CookingMode) => void;
  onGeneral: () => void;
}) {
  const [mode, setMode] = useState<CookingMode>("one_child");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleChild = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmMultiple = () => {
    const ids = mode === "entire_family"
      ? children.map(c => c.id)
      : Array.from(checked);
    if (ids.length === 1) {
      // Treat single selection as one_child
      const found = children.find(c => c.id === ids[0]);
      if (found) onSelectSingle(found);
    } else if (ids.length >= 2) {
      onSelectMultiple(ids, mode);
    }
  };

  const allIds = children.map(c => c.id);
  const confirmIds = mode === "entire_family" ? allIds : Array.from(checked);
  const canConfirm = confirmIds.length >= 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-safe-nav"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        className="w-full max-w-sm bg-[#0f1a13] border border-green-400/20 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Title */}
          <div className="space-y-0.5 pt-1">
            <h2 className="text-base font-bold text-white">Who's eating this?</h2>
            <p className="text-xs text-white/40">Cook one meal safe for all of them at once.</p>
          </div>

          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
            {([
              { id: "one_child",          label: "One child",    emoji: "👶" },
              { id: "multiple_children",  label: "Select some",  emoji: "👨‍👩‍👧" },
              { id: "entire_family",      label: "All children", emoji: "👨‍👩‍👧‍👦" },
            ] as { id: CookingMode; label: string; emoji: string }[]).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setMode(opt.id); setChecked(new Set()); }}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all ${
                  mode === opt.id
                    ? "bg-emerald-600/30 border border-emerald-500/40 text-emerald-200"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                <span className="text-base">{opt.emoji}</span>
                <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Child list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {children.map(child => {
              const isCheckedChild = mode === "entire_family" || checked.has(child.id);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    if (mode === "one_child") {
                      onSelectSingle(child);
                    } else if (mode === "multiple_children") {
                      toggleChild(child.id);
                    }
                    // entire_family: all auto-selected, no toggling
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left active:scale-[0.98] ${
                    mode === "one_child"
                      ? "bg-white/5 border-white/10 hover:bg-emerald-900/30 hover:border-emerald-500/30"
                      : isCheckedChild
                        ? "bg-emerald-900/30 border-emerald-500/30"
                        : "bg-white/5 border-white/10 hover:bg-emerald-900/20 hover:border-emerald-500/20"
                  }`}
                >
                  {mode !== "one_child" && (
                    <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                      isCheckedChild ? "bg-emerald-500 border-emerald-400" : "border-white/30 bg-transparent"
                    }`}>
                      {isCheckedChild && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  )}
                  <span className="text-2xl flex-shrink-0" aria-hidden="true">
                    {child.emoji || "👶"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{child.name}</p>
                    <p className="text-xs text-white/40">
                      {STAGES.find(s => s.id === child.age_stage)?.label ?? child.age_stage}
                      {" · "}
                      {stageAgeLabel(child)}
                    </p>
                  </div>
                  {child.allergies?.length > 0 && (
                    <span className="flex-shrink-0 text-[10px] text-red-300/70 bg-red-900/30 border border-red-400/20 rounded-full px-2 py-0.5">
                      {child.allergies.length} allerg{child.allergies.length === 1 ? "y" : "ies"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Confirm button (multi modes) or General option */}
          {mode !== "one_child" ? (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirmMultiple}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {confirmIds.length >= 2
                ? `Cook for ${confirmIds.length} children`
                : confirmIds.length === 1
                  ? "Cook for 1 child"
                  : "Select at least one child"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onGeneral}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left active:scale-[0.98]"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden="true">🍽️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">General children's meal</p>
                <p className="text-xs text-white/40">No specific child — choose an age range</p>
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface MultiChildMeta {
  childrenIncluded: string[];
  stageLabels: string[];
  primaryStage: string;
}
export default function MyPerfectBeginningCreateMealPage() {
  const [, setLocation] = useLocation();
  usePageTitle("Create a Meal");
  const { toast } = useToast();

  // Form state
  const [selectedStage, setSelectedStage] = useState<DevelopmentalStage | "">("");
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [foodRequest, setFoodRequest] = useState("");
  const [mealOccasion, setMealOccasion] = useState<string>("general");
  const [servings, setServings] = useState<number>(2);
  const [cookingMethod, setCookingMethod] = useState<string>("any");
  const [prepTime, setPrepTime] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [schoolSafe, setSchoolSafe] = useState(false);
  const [packable, setPackable] = useState(false);
  const [budget, setBudget] = useState<string>("");
  const [culturalCuisine, setCulturalCuisine] = useState<string>("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Pre-fill meal idea from URL ?idea= param (set by Parent's Corner action buttons)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idea = params.get("idea");
    if (idea) setFoodRequest(idea);
  }, []);

  // Active child from DB (pre-populate stage + allergies)
  const [activeChild, setActiveChild] = useState<ActiveChildSummary | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Child picker
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [allChildren, setAllChildren] = useState<ChildListItem[]>([]);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recipe, setRecipe] = useState<ChildRecipeResponse | null>(null);
  const [educationLayer, setEducationLayer] = useState<ParentEducationLayerData | null>(null);
  const [showEarlyInfantScreen, setShowEarlyInfantScreen] = useState(false);
  const [hardStopState, setHardStopState] = useState<{ blockReason: string; educationMessage: string } | null>(null);

  // Options step state — Step 1 shows 3 concept cards before full recipe generation
  const [mealOptions, setMealOptions] = useState<{ id: string; name: string; description: string }[]>([]);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);

  // Image state — fires once per recipe, independent of main generation
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Resolver meta — texture class for pediatric info tile + full resolver context for WhyEngineDecidedPanel
  const [resolverTextureClass, setResolverTextureClass] = useState<string | undefined>(undefined);
  const [resolverMeta, setResolverMeta] = useState<ResolverMetaEnhanced | null>(null);

  // Nutrition badges + clinical details — server-computed, parent-friendly
  const [nutritionBadges, setNutritionBadges] = useState<string[]>([]);
  const [clinicalNutritionSummary, setClinicalNutritionSummary] = useState<ClinicalNutritionSummary | null>(null);

  // Multi-child mode
  const [multiChildIds, setMultiChildIds] = useState<string[]>([]);        // IDs of selected children (multi mode)
  const [multiChildLabels, setMultiChildLabels] = useState<string[]>([]);  // display labels
  const [multiChildMeta, setMultiChildMeta] = useState<MultiChildMeta | null>(null);

  const isMultiMode = multiChildIds.length >= 2;

  // STAGE_ORDER for computing most-restrictive on client (for label)
  const STAGE_ORDER: DevelopmentalStage[] = [
    "early_infant", "beginning_foods", "young_toddler", "toddler",
    "preschool", "early_school_age", "growing_child",
  ];

  // Apply a single child selection from the picker
  const applyChildSingle = (child: ChildListItem) => {
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, child.id); } catch {}
    const summary = toActiveSummary(child);
    setActiveChild(summary);
    setSelectedStage(summary.age_stage);
    setAllergies(summary.allergies);
    setMultiChildIds([]);
    setMultiChildLabels([]);
    setShowChildPicker(false);
    if (summary.age_stage === "early_infant") {
      setShowEarlyInfantScreen(true);
    }
  };

  // Apply multiple children from the picker
  const applyChildMultiple = (ids: string[], _mode: CookingMode) => {
    try { localStorage.removeItem(LS_ACTIVE_CHILD_KEY); } catch {}
    const selected = allChildren.filter(c => ids.includes(c.id));

    const stages = selected.map(c => c.age_stage);
    const primaryStage = stages.reduce((best, s) => {
      return STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(best) ? s : best;
    }, stages[0]);

    const severityRank: Record<string, number> = {
      confirmed_allergy: 5, clinician_elimination: 4,
      suspected_reaction: 3, intolerance: 2, preference_avoid: 1,
    };
    const allergenMap = new Map<string, AllergyEntry>();
    for (const child of selected) {
      for (const entry of child.allergies ?? []) {
        if (!entry || typeof entry.allergenId !== "string") continue;
        const existing = allergenMap.get(entry.allergenId);
        const inRank = severityRank[entry.severity] ?? 0;
        const exRank = existing ? (severityRank[existing.severity] ?? 0) : -1;
        if (!existing || inRank > exRank) {
          allergenMap.set(entry.allergenId, { ...entry });
        } else if (entry.emergencyMedication) {
          allergenMap.set(entry.allergenId, { ...existing, emergencyMedication: true });
        }
      }
    }

    const labels = selected.map(c => {
      const sm = STAGES.find(s => s.id === c.age_stage);
      return `${c.name} (${sm?.label ?? c.age_stage})`;
    });

    setActiveChild(null);
    setSelectedStage(primaryStage);
    setAllergies(Array.from(allergenMap.values()) as AllergyEntry[]);
    setMultiChildIds(ids);
    setMultiChildLabels(labels);
    setShowChildPicker(false);
  };

  const applyGeneral = () => {
    try { localStorage.removeItem(LS_ACTIVE_CHILD_KEY); } catch {}
    setActiveChild(null);
    setSelectedStage("");
    setAllergies([]);
    setMultiChildIds([]);
    setMultiChildLabels([]);
    setShowChildPicker(false);
  };

  // Load children on mount and decide whether to show picker
  useEffect(() => {
    fetchAllChildren().then(children => {
      setAllChildren(children);

      const storedId = getStoredActiveId();

      // Returning user with a valid stored selection → skip picker
      if (storedId) {
        const found = children.find(c => c.id === storedId);
        if (found) {
          const summary = toActiveSummary(found);
          setActiveChild(summary);
          setSelectedStage(summary.age_stage);
          setAllergies(summary.allergies);
          if (summary.age_stage === "early_infant") setShowEarlyInfantScreen(true);
          setProfileLoaded(true);
          return;
        }
      }

      // Single child → auto-select, no picker needed
      if (children.length === 1) {
        const summary = toActiveSummary(children[0]);
        try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, children[0].id); } catch {}
        setActiveChild(summary);
        setSelectedStage(summary.age_stage);
        setAllergies(summary.allergies);
        if (summary.age_stage === "early_infant") setShowEarlyInfantScreen(true);
        setProfileLoaded(true);
        return;
      }

      // Multiple children, no stored selection → show picker
      if (children.length >= 2) {
        setShowChildPicker(true);
      }

      // 0 children or fallthrough → bare form
      setProfileLoaded(true);
    });
  }, []);

  useEffect(() => {
    // document.title is managed by usePageTitle("Create a Meal")
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Restore last saved meal for the active child from DB on mount / child-switch.
  // If imageUrl is null (storage failed during original save), re-generate the
  // image in the background and write the persistent URL back to DB.
  useEffect(() => {
    if (!activeChild?.id) return;
    const childProfileId = activeChild.id;
    get<{ meal: { id: string; recipeData: any; imageUrl: string | null; selectedOptionName: string | null } | null }>(
      `/api/my-perfect-beginning/generated-meals?childProfileId=${encodeURIComponent(childProfileId)}`
    )
      .then(data => {
        if (data.meal && !recipe) {
          setRecipe(data.meal.recipeData);
          const restoredImageUrl = data.meal.imageUrl;
          setRecipeImageUrl(restoredImageUrl);

          // If no persisted image, silently regenerate from the recipe data so
          // the card shows an image without the user having to re-generate the recipe.
          if (!restoredImageUrl && data.meal.recipeData?.recipeName) {
            const recipeName: string = data.meal.recipeData.recipeName;
            const ingredients: string[] = (data.meal.recipeData.ingredients ?? []).map((i: any) => i.name ?? i);
            const selectedOptionName = data.meal.selectedOptionName ?? null;
            const savedRecipeData = data.meal.recipeData;
            setImageLoading(true);
            post<{ imageUrl?: string }>('/api/meals/generate-image', {
              mealName: recipeName,
              ingredients,
              mealType: 'meal',
              sourceType: 'meal',
            })
              .then(img => {
                const imgUrl = img.imageUrl ?? null;
                if (imgUrl) {
                  setRecipeImageUrl(imgUrl);
                  // Write the permanent URL back so future reloads skip re-generation.
                  post('/api/my-perfect-beginning/generated-meals', {
                    childProfileId,
                    recipeData: savedRecipeData,
                    imageUrl: imgUrl,
                    selectedOptionName,
                  }).catch(() => {});
                }
              })
              .catch(() => {})
              .finally(() => setImageLoading(false));
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id]);

  // Restore pending options from localStorage so they survive navigation and selection
  useEffect(() => {
    const saved = loadMealOptionsCache();
    if (saved.length > 0) setMealOptions(saved);
  }, []);

  // Persist options to localStorage whenever they change (non-empty → save; empty → clear)
  useEffect(() => {
    if (mealOptions.length > 0) {
      saveMealOptionsCache(mealOptions);
    } else {
      clearMealOptionsCache();
    }
  }, [mealOptions]);

  // Progress ticker
  useEffect(() => {
    if (!isGenerating) { setProgress(0); return; }
    const interval = window.setInterval(() => {
      setProgress(p => p < 88 ? p + Math.max(1, Math.floor((88 - p) * 0.08)) : p);
    }, 160);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async (conceptName?: string) => {
    // Validation: skip when called from option selection (already validated)
    if (!conceptName) {
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
    }

    // Only clear options when starting fresh (no conceptName = new top-level generate,
    // not picking from an existing options list — keep the alternatives visible)
    if (!conceptName) setMealOptions([]);
    setIsGenerating(true);
    setRecipe(null);
    setEducationLayer(null);
    setResolverMeta(null);
    setMultiChildMeta(null);
    setNutritionBadges([]);
    setClinicalNutritionSummary(null);
    setHardStopState(null);

    // Build the full food request string with context appended
    const occasionPrefix = mealOccasion !== "general" ? `${mealOccasion}: ` : "";
    const methodSuffix = cookingMethod !== "any" ? `. Cooking method: ${cookingMethod}` : "";
    const servingsSuffix = servings !== 1 ? `. Serves ${servings}` : "";
    const notesSuffix = notes.trim() ? `. ${notes.trim()}` : "";
    const primaryRequest = conceptName ?? foodRequest.trim();
    const fullFoodRequest = `${occasionPrefix}${primaryRequest}${methodSuffix}${servingsSuffix}${notesSuffix}`.slice(0, 400);

    const parentPrefs: Record<string, unknown> = {};
    if (prepTime) parentPrefs.maxCookTimeMinutes = prepTime;
    if (schoolSafe) parentPrefs.requiresSchoolSafe = true;
    if (packable) parentPrefs.requiresPackable = true;
    if (budget) parentPrefs.budgetLevel = budget;
    if (culturalCuisine.trim()) parentPrefs.culturalCuisine = culturalCuisine.trim();

    try {
      const requestBody: Record<string, unknown> = {
        ageStage: selectedStage,
        allergies,
        foodRequest: fullFoodRequest,
        parentPrefs: Object.keys(parentPrefs).length > 0 ? parentPrefs : undefined,
      };

      if (isMultiMode) {
        requestBody.childProfileIds = multiChildIds;
      } else {
        requestBody.childName = activeChild?.name ?? undefined;
        requestBody.childProfileId = activeChild?.id ?? undefined;
      }

      const data = await post<any>('/api/my-perfect-beginning/create-dish', requestBody);

      if (data.blocked) {
        if (data.blockReason === "early_infant") {
          setShowEarlyInfantScreen(true);
        } else {
          setHardStopState({
            blockReason: data.blockReason,
            educationMessage: data.educationMessage,
          });
        }
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
      if (data.multiChild) {
        setMultiChildMeta(data.multiChild);
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);

      // ── Unified Image Pipeline ─────────────────────────────────────────────
      // /create-dish now returns imageUrl when server-side generation succeeded.
      // Use it directly so the recipe card renders complete — no shimmer.
      if (data.imageUrl) {
        setRecipeImageUrl(data.imageUrl);
        setImageLoading(false);
        // Persist the permanent URL so future reloads restore without re-fetching.
        post('/api/my-perfect-beginning/generated-meals', {
          childProfileId: activeChild?.id ?? null,
          recipeData: data.recipe,
          imageUrl: data.imageUrl,
          selectedOptionName: conceptName ?? null,
        }).catch(() => {});
        return; // outer finally calls setIsGenerating(false); card renders with image
      }
      // Server didn't return imageUrl (generation failed) — fall through to the
      // client-side background fetch below for graceful degradation.
      // ──────────────────────────────────────────────────────────────────────

      // Fire image generation in the background — single fetch, no hook needed
      setRecipeImageUrl(null);
      setImageLoading(true);
      const stage = STAGES.find(s => s.id === selectedStage);
      // Prefer resolver-derived texture/presentation fields — they match what the
      // AI actually cooked, giving a purée stage a smooth image and a toddler
      // plate small soft pieces instead of adult restaurant plating.
      const textureStrategy: string | undefined = data.resolverContext?.textureStrategy;
      const presentationStrategy: string | undefined = data.resolverContext?.presentationStrategy;
      // Also pull the raw textureClass key and active condition IDs for the
      // structured prompt builder (TEXTURE_CLASS_VISUAL + CONDITION_VISUAL_NOTES).
      const resolvedTextureClass: string | undefined = data.resolverMeta?.textureClass;
      // Save texture class for the pediatric info tile in the recipe card
      setResolverTextureClass(resolvedTextureClass);
      // Save full resolver meta for the WhyEngineDecidedPanel
      if (data.resolverMeta) {
        setResolverMeta({
          firedRules: data.resolverMeta.firedRules ?? [],
          activeProtocolBlocks: data.resolverMeta.activeProtocolBlocks ?? [],
          allergenRemovals: data.resolverMeta.allergenRemovals ?? [],
          foodAcceptanceDirectives: data.resolverMeta.foodAcceptanceDirectives ?? [],
          preferencesUsed: data.resolverMeta.preferencesUsed ?? { culturalCuisine: null, dietaryPattern: null, goals: [] },
          conflictResolutions: data.resolverMeta.conflictResolutions ?? [],
          stageDRIBaseline: data.resolverMeta.stageDRIBaseline,
        });
      }
      if (Array.isArray(data.nutritionBadges)) {
        setNutritionBadges(data.nutritionBadges);
      }
      if (data.clinicalNutritionSummary) {
        setClinicalNutritionSummary(data.clinicalNutritionSummary);
      }
      const activeConditionIds: string[] = data.resolverMeta?.activeConditionIds ?? [];
      // Fallback: first sentence of the AI-generated texture note (legacy path)
      const textureHintFallback = data.recipe.textureAndChokingPreparation
        ? data.recipe.textureAndChokingPreparation.split('.')[0].trim()
        : "";
      // Derive source type from meal occasion so snack/dessert/beverage get the
      // correct macro anchor in the image prompt builder.
      const imageSourceType: string = mealOccasion === "Snack" ? "snack"
        : mealOccasion === "Dessert" ? "dessert"
        : mealOccasion === "Smoothie" ? "beverage"
        : "meal";
      const saveRecipeToDb = (imgUrl: string | null) => {
        post('/api/my-perfect-beginning/generated-meals', {
          childProfileId: activeChild?.id ?? null,
          recipeData: data.recipe,
          imageUrl: imgUrl,
          selectedOptionName: conceptName ?? null,
        }).catch(() => {});
      };

      post<{ imageUrl?: string }>('/api/meals/generate-image', {
        mealName: data.recipe.recipeName,
        ingredients: (data.recipe.ingredients ?? []).map((i: any) => i.name ?? i),
        mealType: imageSourceType,
        sourceType: imageSourceType,
        pediatricContext: {
          stage: stage?.label ?? selectedStage,
          ageRange: stage?.ageRange ?? "",
          textureStrategy: textureStrategy || undefined,
          presentationStrategy: presentationStrategy || undefined,
          textureClass: resolvedTextureClass,
          activeConditionIds,
          // Legacy fallback if structured resolver fields are absent
          textureHint: (textureStrategy || resolvedTextureClass)
            ? undefined
            : (textureHintFallback || "soft, age-appropriate texture"),
          portionNote: `small ${(stage?.label ?? "child").toLowerCase()} portion`,
        },
      })
        .then(img => {
          const imgUrl = img.imageUrl ?? null;
          if (imgUrl) setRecipeImageUrl(imgUrl);
          saveRecipeToDb(imgUrl);
        })
        .catch(() => { saveRecipeToDb(null); })
        .finally(() => setImageLoading(false));
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Generate 3 concept options (Step 1) ──────────────────────────────────────
  const handleGenerateOptions = async () => {
    if (!selectedStage) {
      toast({ title: "Select your child's stage", description: "Choose a developmental stage to continue.", variant: "destructive" });
      return;
    }
    if (selectedStage === "early_infant") {
      setShowEarlyInfantScreen(true);
      return;
    }
    if (!foodRequest.trim()) {
      toast({ title: "What would you like to make?", description: "Enter a food or dish to get started.", variant: "destructive" });
      return;
    }

    setIsGeneratingOptions(true);
    setMealOptions([]);

    try {
      const data = await post<{ options: { id: string; name: string; description: string }[] }>(
        '/api/my-perfect-beginning/meal-options',
        {
          ageStage: selectedStage,
          foodRequest: foodRequest.trim(),
          childName: activeChild?.name ?? undefined,
          childProfileId: activeChild?.id ?? undefined,
          allergies: allergies.length > 0 ? allergies : undefined,
        }
      );
      if (Array.isArray(data.options) && data.options.length > 0) {
        setMealOptions(data.options);
        setTimeout(() => window.scrollTo({ top: 200, behavior: "smooth" }), 150);
      } else {
        // No options returned — generate recipe directly as fallback
        handleGenerate();
      }
    } catch {
      // On error — generate recipe directly as fallback
      handleGenerate();
    } finally {
      setIsGeneratingOptions(false);
    }
  };

  const hasEpiPen = allergies.some(a => a.emergencyMedication);
  const stageMeta = STAGES.find(s => s.id === selectedStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen pb-safe-nav"
      style={{
        backgroundImage: "linear-gradient(rgba(2,14,8,0.78), rgba(1,10,5,0.74)), url('/images/mpb-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Child picker sheet — shown when multiple children and no active selection */}
      {showChildPicker && allChildren.length >= 2 && (
        <ChildPickerSheet
          children={allChildren}
          onSelectSingle={applyChildSingle}
          onSelectMultiple={applyChildMultiple}
          onGeneral={applyGeneral}
        />
      )}
      {/* Header */}
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-green-400/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2">
            <Baby className="h-5 w-5 text-green-400 flex-shrink-0" />
            <h1 className="text-lg font-bold text-white truncate">Create a Meal</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12 space-y-5">
        {/* Back to My Perfect Beginnings */}
        <button
          onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
          className="flex items-center gap-1.5 text-emerald-400 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Perfect Beginnings</span>
        </button>

        {/* Tagline */}
        {!recipe && !showEarlyInfantScreen && !hardStopState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pb-2"
          >
            <p className="text-white text-sm leading-relaxed">
              Age-safe, kid-friendly recipes built for how your child eats — not how you do.
            </p>
          </motion.div>
        )}

        {/* Early Infant Education Screen */}
        {showEarlyInfantScreen && (
          <EarlyInfantScreen onBack={() => { setShowEarlyInfantScreen(false); setSelectedStage(""); }} />
        )}

        {/* Hard-Stop Education Screen (PKU, G-tube, etc.) */}
        {!showEarlyInfantScreen && hardStopState && (
          <HardStopScreen
            blockReason={hardStopState.blockReason}
            educationMessage={hardStopState.educationMessage}
            onBack={() => setHardStopState(null)}
          />
        )}

        {/* Meal Option Picker — Step 1: three concepts before full recipe generation */}
        {!showEarlyInfantScreen && !hardStopState && !recipe && mealOptions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-orange-400" />
              <h3 className="text-lg font-bold text-white">Pick your favorite</h3>
            </div>
            <p className="text-sm text-white/60">
              {mealOptions.length} options crafted for {activeChild?.name ?? "your child"}
            </p>
            {mealOptions.map((option, idx) => (
              <Card
                key={idx}
                className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-base mb-1">{option.name}</h4>
                      {option.description && (
                        <p className="text-white/70 text-sm leading-snug">{option.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleGenerate(option.name)}
                      disabled={isGenerating}
                      className="shrink-0 bg-lime-600 hover:bg-lime-500 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pick This
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {isGenerating && (
              <div className="py-4 text-center">
                <p className="text-white/90 text-sm font-medium">
                  Building your kid-friendly recipe <ThinkingDots />
                </p>
              </div>
            )}
            <button
              onClick={() => setMealOptions([])}
              disabled={isGenerating}
              className="w-full text-sm text-white/40 hover:text-white/70 py-2 transition-colors disabled:opacity-50"
            >
              ← Start over with a different request
            </button>
          </div>
        )}

        {/* Generated Recipe */}
        {!showEarlyInfantScreen && !hardStopState && recipe && (
          <div className="space-y-4">
            {/* Multi-child "designed for" banner */}
            {multiChildMeta && multiChildMeta.stageLabels.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-emerald-300">Family meal — designed for all children</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {multiChildMeta.stageLabels.map((label, i) => (
                    <span key={i} className="text-[10px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 rounded-full px-2 py-0.5">
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-white/40 leading-snug">
                  Constraints were merged to the most restrictive safe set across all selected children.
                  Texture and choking preparations are calibrated to the youngest child's stage.
                </p>
              </motion.div>
            )}

            <RecipeCard
              recipe={recipe}
              hasEpiPen={hasEpiPen}
              educationLayer={educationLayer}
              resolverMeta={resolverMeta}
              stageLabel={stageMeta?.label ?? selectedStage}
              textureClass={resolverTextureClass}
              imageUrl={recipeImageUrl}
              imageLoading={imageLoading}
              nutritionBadges={nutritionBadges}
              clinicalNutritionSummary={clinicalNutritionSummary}
              ageStage={selectedStage}
              allergies={allergies}
              parentPrefs={{
                ...(prepTime ? { maxCookTimeMinutes: prepTime } : {}),
                ...(schoolSafe ? { requiresSchoolSafe: true } : {}),
                ...(packable ? { requiresPackable: true } : {}),
                ...(budget ? { budgetLevel: budget } : {}),
                ...(culturalCuisine.trim() ? { culturalCuisine: culturalCuisine.trim() } : {}),
              }}
              onDelete={() => {
                setRecipe(null);
                setEducationLayer(null);
                setResolverMeta(null);
                setMultiChildMeta(null);
                setNutritionBadges([]);
                setClinicalNutritionSummary(null);
                setHardStopState(null);
                setFoodRequest("");
                setMealOptions([]);
                setRecipeImageUrl(null);
                setImageLoading(false);
                setResolverTextureClass(undefined);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onUpdateRecipe={(updated) => setRecipe(prev => prev ? { ...prev, ...updated } : prev)}
              setLocation={setLocation}
            />

            {/* Generated Alternatives — unchosen options stay visible until a new request */}
            {mealOptions.filter((o) => o.name !== recipe.recipeName).length > 0 && (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  <Sparkles className="h-4 w-4 text-orange-400/60" />
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
                    Other Options
                  </h3>
                </div>
                {mealOptions
                  .filter((o) => o.name !== recipe.recipeName)
                  .map((option, idx) => (
                    <Card
                      key={idx}
                      className="bg-black/25 backdrop-blur-lg border border-orange-400/10 shadow-md rounded-2xl"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-sm mb-1 break-words">
                              {option.name}
                            </h4>
                            {option.description && (
                              <p className="text-white/60 text-xs line-clamp-2">{option.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerate(option.name)}
                            disabled={isGenerating}
                            className="shrink-0 bg-lime-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                          >
                            Pick This
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                <button
                  onClick={() => {
                    setMealOptions([]);
                    setFoodRequest("");
                    setRecipe(null);
                    setRecipeImageUrl(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-xs text-white/40 hover:text-white/70 py-2 transition-colors"
                >
                  Start over with a different request
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setRecipe(null);
                setEducationLayer(null);
                setResolverMeta(null);
                setMultiChildMeta(null);
                setNutritionBadges([]);
                setClinicalNutritionSummary(null);
                setHardStopState(null);
                setFoodRequest("");
                setMealOptions([]);
                setRecipeImageUrl(null);
                setImageLoading(false);
                setResolverTextureClass(undefined);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full py-3 rounded-xl bg-green-500/10 text-green-300 text-sm font-medium border border-green-400/20 hover:bg-green-500/20 transition-all"
            >
              Make Another Recipe
            </button>
          </div>
        )}

        {/* Input Form — only shown when there are no pending option cards */}
        {!showEarlyInfantScreen && !hardStopState && !recipe && mealOptions.length === 0 && (
          <div className="space-y-4">
            {/* Active child profile indicator */}
            {profileLoaded && isMultiMode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-emerald-900/30 border border-emerald-500/25 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-sm">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-300 font-medium">
                      Family meal — {multiChildIds.length} children
                    </p>
                    <p className="text-[11px] text-white/40 leading-tight">
                      Constraints merged to the most restrictive safe set.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowChildPicker(true)}
                    className="flex-shrink-0 text-[11px] text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2"
                  >
                    Change
                  </button>
                </div>
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {multiChildLabels.map((label, i) => (
                    <span key={i} className="text-[10px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 rounded-full px-2 py-0.5">
                      {label}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
            {profileLoaded && !isMultiMode && activeChild && (
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
                  <p className="text-[11px] text-white leading-tight">
                    Stage and allergies pre-loaded — just type what you'd like to make.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (allChildren.length >= 2) {
                      setShowChildPicker(true);
                    } else {
                      setLocation("/lifestyle/my-perfect-beginning");
                    }
                  }}
                  className="flex-shrink-0 text-[11px] text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2"
                >
                  Switch child
                </button>
              </motion.div>
            )}
            {profileLoaded && !isMultiMode && !activeChild && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                <Baby className="h-4 w-4 text-white flex-shrink-0" />
                <p className="text-xs text-white flex-1">
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
                          : "bg-black/20 border-white/10 text-white hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{stage.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block">{stage.label}</span>
                        <span className="text-xs text-white">{stage.ageRange}</span>
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
                    <p className="text-xs text-white mt-0.5">
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
                  <span className="text-xs font-normal text-white ml-1">(optional)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <AllergenSelector allergies={allergies} onChange={setAllergies} />
                {allergies.length === 0 && (
                  <p className="text-xs text-white mt-2">Tap an allergen above to add it. You can set severity and EpiPen status for each.</p>
                )}
              </CardContent>
            </Card>

            {/* Meal occasion */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-amber-400" />
                  What are you making today?
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "general", label: "Any Meal", emoji: "🍽️" },
                    { id: "Breakfast", label: "Breakfast", emoji: "🥞" },
                    { id: "Lunch", label: "Lunch", emoji: "🥪" },
                    { id: "Dinner", label: "Dinner", emoji: "🍝" },
                    { id: "Snack", label: "Snack", emoji: "🍎" },
                    { id: "Lunchbox", label: "Lunchbox", emoji: "🎒" },
                    { id: "Smoothie", label: "Smoothie", emoji: "🥤" },
                    { id: "Dessert", label: "Dessert", emoji: "🍮" },
                    { id: "Party Food", label: "Party Food", emoji: "🎉" },
                    { id: "Sick Day", label: "Sick Day", emoji: "🤒" },
                    { id: "Quick Meal", label: "Quick Meal", emoji: "⚡" },
                  ].map(occ => (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => setMealOccasion(occ.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                        mealOccasion === occ.id
                          ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                          : "bg-white/5 border-white/10 text-white hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <span>{occ.emoji}</span>
                      {occ.label}
                    </button>
                  ))}
                </div>
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
                  className="w-full px-3 py-2 bg-black text-white placeholder:text-white border border-white/10 rounded-lg h-20 resize-none text-sm focus:outline-none focus:border-green-400/40"
                  maxLength={200}
                />
                <p className="text-xs text-white text-right">{foodRequest.length}/200</p>
              </CardContent>
            </Card>

            {/* Servings + Cooking method + Prep time row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Servings */}
              <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    Servings
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 4, 6, 8].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setServings(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          servings === s
                            ? "bg-blue-500/20 border-blue-400/50 text-blue-200"
                            : "bg-white/5 border-white/10 text-white hover:border-white/25"
                        }`}
                      >
                        {s === 1 ? "1" : `${s}`}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cooking method */}
              <Card className="bg-black/40 border-white/10 backdrop-blur-lg sm:col-span-2">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Utensils className="h-3.5 w-3.5 text-orange-400" />
                    Cooking method
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "any", label: "Any", emoji: "✨" },
                      { id: "Stovetop", label: "Stovetop", emoji: "🍳" },
                      { id: "Oven", label: "Oven", emoji: "🫕" },
                      { id: "Air Fryer", label: "Air Fryer", emoji: "💨" },
                      { id: "Slow Cooker", label: "Slow Cooker", emoji: "🥘" },
                      { id: "No-Bake", label: "No-Bake", emoji: "❄️" },
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCookingMethod(m.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          cookingMethod === m.id
                            ? "bg-orange-500/20 border-orange-400/50 text-orange-200"
                            : "bg-white/5 border-white/10 text-white hover:border-white/25"
                        }`}
                      >
                        <span>{m.emoji}</span>{m.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Prep time */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  Prep time
                  <span className="text-xs font-normal text-white ml-1">optional</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex gap-2">
                  {[
                    { value: null, label: "Any" },
                    { value: 15, label: "15 min" },
                    { value: 30, label: "30 min" },
                    { value: 45, label: "45 min" },
                    { value: 60, label: "1 hr" },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setPrepTime(opt.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        prepTime === opt.value
                          ? "bg-purple-500/20 border-purple-400/50 text-purple-200"
                          : "bg-white/5 border-white/10 text-white hover:border-white/25"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tell us anything helpful */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Info className="h-4 w-4 text-white" />
                  Tell us anything helpful
                  <span className="text-xs font-normal text-white ml-1">optional</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Birthday party · After-school snack · Picky eater today · Grandma is visiting · Needs to travel"
                  className="w-full px-3 py-2 bg-black text-white placeholder:text-white border border-white/10 rounded-lg h-16 resize-none text-sm focus:outline-none focus:border-white/25"
                  maxLength={200}
                />
                <p className="text-xs text-white text-right">{notes.length}/200</p>
              </CardContent>
            </Card>

            {/* More options (school safe, packable, budget, cultural cuisine) */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreOptions(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:text-white hover:border-white/20 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  More options
                  {(schoolSafe || packable || budget || culturalCuisine.trim()) && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                      {[schoolSafe, packable, !!budget, !!culturalCuisine.trim()].filter(Boolean).length} set
                    </span>
                  )}
                </span>
                {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {showMoreOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 space-y-3"
                >
                  {/* Toggles row */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSchoolSafe(v => !v)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        schoolSafe
                          ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                          : "bg-white/5 border-white/10 text-white hover:border-white/25"
                      }`}
                    >
                      <span>🏫</span>
                      <span>School Safe</span>
                      {schoolSafe && <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackable(v => !v)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        packable
                          ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                          : "bg-white/5 border-white/10 text-white hover:border-white/25"
                      }`}
                    >
                      <span>🎒</span>
                      <span>Packable Lunch</span>
                      {packable && <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-400" />}
                    </button>
                  </div>

                  {/* Budget */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-white px-1">Budget</p>
                    <div className="flex gap-2">
                      {[
                        { id: "", label: "Any" },
                        { id: "budget_conscious", label: "Budget" },
                        { id: "moderate", label: "Moderate" },
                        { id: "flexible", label: "Flexible" },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBudget(opt.id)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            budget === opt.id
                              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                              : "bg-white/5 border-white/10 text-white hover:border-white/25"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cultural cuisine */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-white px-1">Cultural cuisine <span className="text-white">(optional)</span></p>
                    <input
                      type="text"
                      value={culturalCuisine}
                      onChange={e => setCulturalCuisine(e.target.value)}
                      placeholder="e.g. Mexican, Japanese, West African…"
                      maxLength={80}
                      className="w-full px-3 py-2 bg-black text-white placeholder:text-white border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/25"
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Progress / loading states */}
            {isGeneratingOptions && (
              <div className="py-2 text-center">
                <p className="text-white/90 text-sm font-medium flex items-center justify-center gap-1">
                  Finding the best options for {activeChild?.name ?? "your child"} <ThinkingDots />
                </p>
              </div>
            )}

            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-white/10" />
                <p className="text-center text-xs text-white flex items-center justify-center gap-1">
                  Building your kid-friendly recipe <ThinkingDots />
                </p>
              </div>
            )}

            {/* Generate button — Step 1: get 3 options to choose from */}
            <button
              type="button"
              onClick={handleGenerateOptions}
              disabled={isGeneratingOptions || isGenerating || !selectedStage}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm shadow-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isGeneratingOptions ? "Finding options…" : isGenerating ? "Creating Recipe…" : "See Meal Options"}
            </button>

            {/* Disclaimer */}
            <p className="text-center text-xs text-white leading-relaxed px-4">
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

const BADGE_CONFIG: Record<string, { emoji: string; pill: string }> = {
  "Iron Rich":              { emoji: "🥩", pill: "bg-red-900/30 border-red-500/30 text-red-200" },
  "Good Source of Calcium": { emoji: "🥛", pill: "bg-teal-900/30 border-teal-500/30 text-teal-200" },
  "High Fiber":             { emoji: "🌿", pill: "bg-green-900/30 border-green-500/30 text-green-200" },
  "Healthy Fats":           { emoji: "🫒", pill: "bg-blue-900/30 border-blue-500/30 text-blue-200" },
  "Vitamin C Included":     { emoji: "🍊", pill: "bg-orange-900/30 border-orange-500/30 text-orange-200" },
  "Protein-Packed":         { emoji: "💪", pill: "bg-purple-900/30 border-purple-500/30 text-purple-200" },
  "Calorie Dense":          { emoji: "⚡", pill: "bg-yellow-900/30 border-yellow-500/30 text-yellow-200" },
  "Dairy-Free":             { emoji: "🌱", pill: "bg-cyan-900/30 border-cyan-500/30 text-cyan-200" },
  "Gluten-Free":            { emoji: "✳️", pill: "bg-amber-900/30 border-amber-500/30 text-amber-200" },
};

interface ClinicalNutritionSummary {
  stageDRI: ClinicalDRI;
  estimatedCarbsPerServing?: string;
  activeConditionLabels: string[];
  note: string;
}

function ClinicalDetailsPanel({ summary }: { summary: ClinicalNutritionSummary }) {
  const [open, setOpen] = useState(false);
  const dri = summary.stageDRI;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
          <span className="text-xs font-medium text-white/40">Clinical Details</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {/* Estimated carbs — shown when T1D/T2D protocol is active */}
          {summary.estimatedCarbsPerServing && (
            <div className="pt-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Estimated Carbs / Serving</p>
              <p className="text-sm font-semibold text-white">{summary.estimatedCarbsPerServing}</p>
              <p className="text-[10px] text-white/30 mt-0.5">AI estimate based on ingredients — verify with carb-counting tools</p>
            </div>
          )}

          {/* Stage DRI reference */}
          {dri.kcalRange !== "Varies by stage" && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Daily Reference Ranges (USDA / AAP)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Energy", value: dri.kcalRange },
                  { label: "Protein", value: dri.proteinRange },
                  { label: "Iron", value: dri.ironMg > 0 ? `${dri.ironMg} mg/day` : "—" },
                  { label: "Calcium", value: dri.calciumMg > 0 ? `${dri.calciumMg} mg/day` : "—" },
                  { label: "Sodium max", value: dri.sodiumMgMax > 0 ? `${dri.sodiumMgMax} mg/day` : "—" },
                  { label: "Added sugar max", value: dri.addedSugarGMax > 0 ? `${dri.addedSugarGMax} g/day` : "—" },
                ].map(row => (
                  <div key={row.label} className="rounded-md bg-black/30 px-2.5 py-1.5">
                    <p className="text-[10px] text-white/30">{row.label}</p>
                    <p className="text-xs text-white/70 font-medium">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active conditions */}
          {summary.activeConditionLabels.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Active Condition Protocols</p>
              <div className="space-y-0.5">
                {summary.activeConditionLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                    <ShieldCheck className="h-2.5 w-2.5 text-blue-400/70 flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/25 leading-snug">{summary.note}</p>
        </div>
      )}
    </div>
  );
}

// ── Side Recipe Bottom Sheet ──────────────────────────────────────────────────

function SideRecipeSheet({
  side,
  recipe,
  loading,
  error,
  onClose,
}: {
  side: CompletePlateSide;
  recipe: ChildRecipeResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const steps = recipe?.instructions ?? [];
  const visibleSteps = stepsExpanded ? steps : steps.slice(0, 3);

  return (
    <AnimatePresence>
      <motion.div
        key="side-recipe-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-3 pb-safe-nav"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 48 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-full max-w-md bg-[#0b1a10] border border-emerald-400/25 rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        >
          {/* Handle + header */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-white/8">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400/80 font-medium uppercase tracking-wider mb-0.5">Side Recipe</p>
                <h2 className="text-base font-bold text-white leading-tight truncate">{side.name}</h2>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-10">
                <ThinkingDots />
                <p className="text-sm text-white/60">Building a recipe for {side.name}…</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-400/30">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-200">{error}</p>
              </div>
            )}

            {recipe && !loading && (
              <>
                {/* Recipe name */}
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <h3 className="text-sm font-bold text-white">{recipe.recipeName}</h3>
                </div>

                {/* Age suitability */}
                <p className="text-xs text-white/60">{recipe.ageStageSuitability}</p>

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

                {/* Texture & choking safety */}
                {recipe.textureAndChokingPreparation && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/25 border border-amber-400/25">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300 mb-0.5">Texture & Choking Safety</p>
                      <p className="text-xs text-white leading-relaxed">{recipe.textureAndChokingPreparation}</p>
                    </div>
                  </div>
                )}

                {/* Ingredients */}
                {recipe.ingredients.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Ingredients</h4>
                    <ul className="space-y-1.5">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white">
                          <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
                          <span>
                            {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""} <strong>{ing.name}</strong>
                            {ing.prepNote && (
                              <span className="block text-xs text-white/60 mt-0.5">{ing.prepNote}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructions */}
                {steps.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Instructions</h4>
                    <div className="space-y-2">
                      {visibleSteps.map((step, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="min-w-[22px] h-[22px] w-[22px] rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p className="text-sm leading-relaxed text-white">{step}</p>
                        </div>
                      ))}
                    </div>
                    {steps.length > 3 && (
                      <button
                        className="mt-2 text-xs text-emerald-400 font-medium"
                        onClick={() => setStepsExpanded(v => !v)}
                      >
                        {stepsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                      </button>
                    )}
                  </div>
                )}

                {/* Serving guidance */}
                {recipe.servingGuidance && (
                  <div>
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-1">Serving Guidance</h4>
                    <p className="text-sm text-white">{recipe.servingGuidance}</p>
                  </div>
                )}

                {/* Why this version */}
                {recipe.whyThisVersionIsBetter && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-400/20">
                    <p className="text-xs text-emerald-300/90 leading-relaxed">{recipe.whyThisVersionIsBetter}</p>
                  </div>
                )}

                {/* Pediatrician note */}
                {recipe.askPediatricianNote && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-950/25 border border-blue-400/20">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-300 mb-0.5">Ask Your Pediatrician</p>
                      <p className="text-xs text-white leading-relaxed">{recipe.askPediatricianNote}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer close button */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all active:scale-[0.98]"
            >
              Back to Complete the Plate
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Complete the Plate Section ────────────────────────────────────────────────

function CompleteThePlateSection({
  completePlate,
  ageStage,
  allergies,
  parentPrefs,
}: {
  completePlate: CompletePlate;
  ageStage: DevelopmentalStage | "";
  allergies: AllergyEntry[];
  parentPrefs?: ParentPrefs;
}) {
  const { toast } = useToast();
  const [activeSide, setActiveSide] = useState<CompletePlateSide | null>(null);
  const [sideRecipe, setSideRecipe] = useState<ChildRecipeResponse | null>(null);
  const [sideLoading, setSideLoading] = useState(false);
  const [sideError, setSideError] = useState<string | null>(null);

  if (!completePlate || !completePlate.sides || completePlate.sides.length === 0) return null;

  const handleGetRecipe = async (side: CompletePlateSide) => {
    if (!ageStage) {
      toast({ title: "Age stage required", description: "Please select an age stage first.", variant: "destructive" });
      return;
    }
    setActiveSide(side);
    setSideRecipe(null);
    setSideError(null);
    setSideLoading(true);

    try {
      const body: Record<string, unknown> = {
        ageStage,
        allergies,
        foodRequest: side.name,
      };
      if (parentPrefs && Object.keys(parentPrefs).length > 0) {
        body.parentPrefs = parentPrefs;
      }
      const data = await post<any>('/api/my-perfect-beginning/create-dish', body);
      if (data.blocked) {
        setSideError(data.educationMessage ?? "This side couldn't be generated for the selected age stage.");
      } else {
        setSideRecipe(data as ChildRecipeResponse);
      }
    } catch (err: any) {
      setSideError(err?.message ?? "Something went wrong generating the recipe.");
    } finally {
      setSideLoading(false);
    }
  };

  return (
    <>
      {activeSide && (
        <SideRecipeSheet
          side={activeSide}
          recipe={sideRecipe}
          loading={sideLoading}
          error={sideError}
          onClose={() => { setActiveSide(null); setSideRecipe(null); setSideError(null); }}
        />
      )}

      <Card className="bg-black/40 backdrop-blur-lg border border-emerald-400/25 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-emerald-500/15 flex-shrink-0">
              <Utensils className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Complete the Plate</h3>
              <p className="text-xs text-white/60 mt-0.5">Stage-appropriate sides to round out this meal</p>
            </div>
          </div>

          {/* Sides */}
          <div className="space-y-3">
            {completePlate.sides.map((side, i) => {
              const cfg = CATEGORY_CONFIG[side.category] ?? { emoji: "🍽️", label: "Side", color: "text-white bg-white/5 border-white/10" };
              return (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  <div className="p-3.5 space-y-2">
                    {/* Side name + category badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xl flex-shrink-0" aria-hidden="true">{cfg.emoji}</span>
                        <p className="text-sm font-semibold text-white leading-tight">{side.name}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Serving size + prep */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                      {side.servingSize && (
                        <span>
                          <span className="text-white/40">Portion: </span>
                          {side.servingSize}
                        </span>
                      )}
                      {side.prepNote && (
                        <span>
                          <span className="text-white/40">Prep: </span>
                          {side.prepNote}
                        </span>
                      )}
                    </div>

                    {/* Why this side was chosen */}
                    {side.nutritionalRole && (
                      <p className="text-xs text-emerald-300/80 leading-relaxed">
                        ✓ {side.nutritionalRole}
                      </p>
                    )}

                    {/* Get recipe button */}
                    <button
                      type="button"
                      onClick={() => handleGetRecipe(side)}
                      className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/25 px-3 py-1.5 rounded-lg transition-all active:scale-[0.97]"
                    >
                      <ChefHat className="h-3 w-3" />
                      Get recipe
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plate note */}
          {completePlate.plateNote && (
            <div className="flex items-start gap-2 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white/70 leading-relaxed italic">{completePlate.plateNote}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

interface CompletePlate {
  sides: CompletePlateSide[];
  plateNote: string;
}
