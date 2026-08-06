import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/apiRequest";
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

// ── Parent Education Panel — confidence, personalization, clinical review ──────

function ParentEducationPanel({ layer }: { layer: ParentEducationLayerData }) {
  const starsFilled = layer.mealConfidence.stars ?? 0;
  const completeness = layer.mealConfidence.profileCompleteness;
  const dimsUsed = layer.personalizationLevel.dimensionsUsed ?? [];
  const reviews = layer.clinicalReviewStatus ?? [];

  return (
    <div className="space-y-3">
      {/* Confidence */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white">Meal Confidence</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(n => (
              <Star
                key={n}
                className={`h-3 w-3 ${n <= starsFilled ? "text-yellow-400 fill-yellow-400" : "text-white"}`}
              />
            ))}
          </div>
          {completeness != null && (
            <span className="text-xs text-white">{completeness}% profile used</span>
          )}
        </div>
      </div>

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

// ── Recipe Display (Create a Dish–style card) ─────────────────────────────────

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
}: {
  recipe: ChildRecipeResponse;
  hasEpiPen: boolean;
  educationLayer: ParentEducationLayerData | null;
  resolverMeta: ResolverMetaEnhanced | null;
  stageLabel: string;
  textureClass?: string;
  imageUrl: string | null;
  imageLoading: boolean;
  onDelete: () => void;
  onUpdateRecipe: (updated: Partial<ChildRecipeResponse>) => void;
  setLocation: (path: string) => void;
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

          {/* Pediatric info tiles — replaces adult macro tiles */}
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-green-300 leading-tight">{stageLabel.split(" ").slice(0, 1).join("")}</div>
              <div className="text-[10px] text-white mt-0.5">Age Group</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-amber-300 leading-tight">{formatTextureClass(textureClass).split(" ")[0]}</div>
              <div className="text-[10px] text-white mt-0.5">Texture</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-purple-300 leading-tight">{confidencePct}</div>
              <div className="text-[10px] text-white mt-0.5">Confidence</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
              <div className="text-sm font-bold text-blue-300 leading-tight truncate">✓</div>
              <div className="text-[10px] text-white mt-0.5">Reviewed</div>
            </div>
          </div>

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
                        {ing.prepNote && <span className="text-white"> — {ing.prepNote}</span>}
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

// ── Child Picker Sheet ─────────────────────────────────────────────────────────

function ChildPickerSheet({
  children,
  onSelect,
  onGeneral,
}: {
  children: ChildListItem[];
  onSelect: (child: ChildListItem) => void;
  onGeneral: () => void;
}) {
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
            <h2 className="text-base font-bold text-white">Who are you cooking for?</h2>
            <p className="text-xs text-white">Choose a child or cook a general meal.</p>
          </div>

          {/* Child options */}
          <div className="space-y-2">
            {children.map(child => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-emerald-900/30 hover:border-emerald-500/30 transition-all text-left active:scale-[0.98]"
              >
                <span className="text-2xl flex-shrink-0" aria-hidden="true">
                  {child.emoji || "👶"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{child.name}</p>
                  <p className="text-xs text-white">
                    {STAGES.find(s => s.id === child.age_stage)?.label ?? child.age_stage}
                    {" · "}
                    {stageAgeLabel(child)}
                    {child.age_stage !== "early_infant" && !child.date_of_birth
                      ? ""
                      : child.date_of_birth
                        ? " yrs"
                        : ""}
                  </p>
                </div>
                {child.allergies?.length > 0 && (
                  <span className="flex-shrink-0 text-[10px] text-red-300/70 bg-red-900/30 border border-red-400/20 rounded-full px-2 py-0.5">
                    {child.allergies.length} allerg{child.allergies.length === 1 ? "y" : "ies"}
                  </span>
                )}
              </button>
            ))}

            {/* General option */}
            <button
              type="button"
              onClick={onGeneral}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left active:scale-[0.98]"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden="true">🍽️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">General children's meal</p>
                <p className="text-xs text-white">No specific child — choose an age range</p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
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

  // Image state — fires once per recipe, independent of main generation
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Resolver meta — texture class for pediatric info tile + full resolver context for WhyEngineDecidedPanel
  const [resolverTextureClass, setResolverTextureClass] = useState<string | undefined>(undefined);
  const [resolverMeta, setResolverMeta] = useState<ResolverMetaEnhanced | null>(null);

  // Apply a child selection from the picker
  const applyChild = (child: ChildListItem) => {
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, child.id); } catch {}
    const summary = toActiveSummary(child);
    setActiveChild(summary);
    setSelectedStage(summary.age_stage);
    setAllergies(summary.allergies);
    setShowChildPicker(false);
    if (summary.age_stage === "early_infant") {
      setShowEarlyInfantScreen(true);
    }
  };

  const applyGeneral = () => {
    try { localStorage.removeItem(LS_ACTIVE_CHILD_KEY); } catch {}
    setActiveChild(null);
    setSelectedStage("");
    setAllergies([]);
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
    setResolverMeta(null);
    setHardStopState(null);

    // Build the full food request string with context appended
    const occasionPrefix = mealOccasion !== "general" ? `${mealOccasion}: ` : "";
    const methodSuffix = cookingMethod !== "any" ? `. Cooking method: ${cookingMethod}` : "";
    const servingsSuffix = servings !== 1 ? `. Serves ${servings}` : "";
    const notesSuffix = notes.trim() ? `. ${notes.trim()}` : "";
    const fullFoodRequest = `${occasionPrefix}${foodRequest.trim()}${methodSuffix}${servingsSuffix}${notesSuffix}`.slice(0, 400);

    const parentPrefs: Record<string, unknown> = {};
    if (prepTime) parentPrefs.maxCookTimeMinutes = prepTime;
    if (schoolSafe) parentPrefs.requiresSchoolSafe = true;
    if (packable) parentPrefs.requiresPackable = true;
    if (budget) parentPrefs.budgetLevel = budget;
    if (culturalCuisine.trim()) parentPrefs.culturalCuisine = culturalCuisine.trim();

    try {
      const data = await apiRequest(apiUrl("/api/my-perfect-beginning/create-dish"), {
        method: "POST",
        body: JSON.stringify({
          ageStage: selectedStage,
          allergies,
          foodRequest: fullFoodRequest,
          childName: activeChild?.name ?? undefined,
          childProfileId: activeChild?.id ?? undefined,
          parentPrefs: Object.keys(parentPrefs).length > 0 ? parentPrefs : undefined,
        }),
      });

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
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);

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
      fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
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
        }),
      })
        .then(r => r.json())
        .then(img => { if (img.imageUrl) setRecipeImageUrl(img.imageUrl); })
        .catch(() => {})
        .finally(() => setImageLoading(false));
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
          onSelect={applyChild}
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

        {/* Generated Recipe */}
        {!showEarlyInfantScreen && !hardStopState && recipe && (
          <div className="space-y-4">
            <RecipeCard
              recipe={recipe}
              hasEpiPen={hasEpiPen}
              educationLayer={educationLayer}
              resolverMeta={resolverMeta}
              stageLabel={stageMeta?.label ?? selectedStage}
              textureClass={resolverTextureClass}
              imageUrl={recipeImageUrl}
              imageLoading={imageLoading}
              onDelete={() => {
                setRecipe(null);
                setEducationLayer(null);
                setResolverMeta(null);
                setHardStopState(null);
                setFoodRequest("");
                setRecipeImageUrl(null);
                setImageLoading(false);
                setResolverTextureClass(undefined);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onUpdateRecipe={(updated) => setRecipe(prev => prev ? { ...prev, ...updated } : prev)}
              setLocation={setLocation}
            />
            <button
              type="button"
              onClick={() => {
                setRecipe(null);
                setEducationLayer(null);
                setResolverMeta(null);
                setHardStopState(null);
                setFoodRequest("");
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

        {/* Input Form */}
        {!showEarlyInfantScreen && !hardStopState && !recipe && (
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
            {profileLoaded && !activeChild && (
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

            {/* Progress bar while generating */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5 bg-white/10" />
                <p className="text-center text-xs text-white flex items-center justify-center gap-1">
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
