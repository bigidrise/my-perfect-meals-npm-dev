import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import {
  useClinicalInterventions,
  type InterventionConditionKey,
  type InterventionSeverity,
} from "@/hooks/useClinicalInterventions";
import {
  INTERVENTION_CONDITION_LABELS,
  INTERVENTION_SEVERITY_LABELS,
  INTERVENTION_PROVIDER_EFFECTS,
} from "@shared/interventionTypes";

interface Props {
  clientUserId: string;
}

type TabKey = "gi_symptoms" | "nutrition" | "weight_and_risk" | "notes";

const GI_CONDITIONS: InterventionConditionKey[] = [
  "nausea",
  "vomiting",
  "constipation",
  "diarrhea",
  "early_fullness",
  "reflux",
  "poor_appetite",
  "food_aversion",
];

const NUTRITION_CONDITIONS: InterventionConditionKey[] = [
  "poor_hydration",
  "low_protein",
  "low_calorie",
  "muscle_preservation_risk",
  "glucose_concerns",
  "fatigue",
];

const WEIGHT_CONDITIONS: InterventionConditionKey[] = [
  "rapid_weight_loss",
  "transitioning_off_medication",
];

const SEVERITY_ORDER: InterventionSeverity[] = ["none", "mild", "moderate", "severe"];

const SEVERITY_COLORS: Record<InterventionSeverity, string> = {
  none:     "bg-white/10 text-white/60 border-white/10",
  mild:     "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  moderate: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  severe:   "bg-red-500/20 text-red-300 border-red-500/30",
};

const SEVERITY_ACTIVE: Record<InterventionSeverity, string> = {
  none:     "bg-white/15 text-white border-white/30 ring-1 ring-white/30",
  mild:     "bg-yellow-500/40 text-yellow-200 border-yellow-400/60 ring-1 ring-yellow-400/50",
  moderate: "bg-orange-500/40 text-orange-200 border-orange-400/60 ring-1 ring-orange-400/50",
  severe:   "bg-red-500/40 text-red-200 border-red-400/60 ring-1 ring-red-400/50",
};

function ConditionRow({
  conditionKey,
  currentSeverity,
  isSaving,
  onSet,
}: {
  conditionKey: InterventionConditionKey;
  currentSeverity: InterventionSeverity;
  isSaving: boolean;
  onSet: (s: InterventionSeverity) => void;
}) {
  const label = INTERVENTION_CONDITION_LABELS[conditionKey] ?? conditionKey;
  const isActive = currentSeverity !== "none" && currentSeverity !== undefined;
  const effects =
    isActive && currentSeverity !== "none"
      ? (INTERVENTION_PROVIDER_EFFECTS[conditionKey]?.[currentSeverity as "mild" | "moderate" | "severe"] ?? [])
      : [];

  return (
    <div className={`rounded-xl border px-4 py-3 transition-all ${
      isActive ? "border-white/20 bg-white/5" : "border-white/8 bg-white/[0.02]"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isActive ? (
            <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />
          ) : (
            <div className="h-4 w-4 rounded-full border border-white/20 shrink-0" />
          )}
          <span className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-white/60"}`}>
            {label}
          </span>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-orange-400 shrink-0" />}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {SEVERITY_ORDER.map((sev) => {
            const isCurrent = (currentSeverity ?? "none") === sev;
            return (
              <button
                key={sev}
                onClick={() => onSet(sev)}
                disabled={isSaving}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  isCurrent ? SEVERITY_ACTIVE[sev] : SEVERITY_COLORS[sev]
                }`}
              >
                {INTERVENTION_SEVERITY_LABELS[sev] ?? sev}
              </button>
            );
          })}
        </div>
      </div>

      {/* Provider effect preview — visible immediately when condition is active */}
      {isActive && effects.length > 0 && (
        <div className="mt-2.5 pl-6 border-l border-orange-500/20 ml-2">
          <p className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wide mb-1">
            This intervention will:
          </p>
          <ul className="space-y-0.5">
            {effects.map((effect, i) => (
              <li key={i} className="text-xs text-white/45 leading-relaxed">
                {effect.startsWith("⚠️") || effect.startsWith("🚨") ? (
                  <span className={effect.startsWith("🚨") ? "text-red-400/80" : "text-yellow-400/70"}>
                    {effect}
                  </span>
                ) : (
                  <span>• {effect}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ClinicalInterventionPanel({ clientUserId }: Props) {
  const { interventions, loading, saving, setSeverity, escalationFlags } = useClinicalInterventions(clientUserId);
  const [activeTab, setActiveTab] = useState<TabKey>("gi_symptoms");
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = Object.values(interventions).filter(s => s && s !== "none").length;

  const renderConditions = (keys: InterventionConditionKey[]) => (
    <div className="space-y-2">
      {keys.map((key) => (
        <ConditionRow
          key={key}
          conditionKey={key}
          currentSeverity={(interventions[key] ?? "none") as InterventionSeverity}
          isSaving={saving.has(key)}
          onSet={(sev) => setSeverity(key, sev)}
        />
      ))}
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <span className="text-orange-400 text-sm">🩺</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Clinical Adjustments</div>
            <div className="text-xs text-white/50">
              {loading
                ? "Loading…"
                : activeCount > 0
                ? `${activeCount} active condition${activeCount !== 1 ? "s" : ""} — changing patient recommendations`
                : "No active conditions — select below to adjust patient experience"}
            </div>
          </div>
          {escalationFlags.length > 0 && (
            <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-2.5 py-0.5">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-300 font-medium">
                {escalationFlags.length} escalation{escalationFlags.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronUp className="h-4 w-4 text-white/40" />
        )}
      </button>

      {!collapsed && (
        <div className="px-5 pb-5">
          {/* Escalation banner */}
          {escalationFlags.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-300 mb-1">Provider Review Recommended</div>
                <div className="text-xs text-red-300/70">
                  {escalationFlags.map(k => INTERVENTION_CONDITION_LABELS[k]).join(" · ")} flagged as severe.
                  These symptoms may require clinical intervention beyond nutrition adjustments.
                </div>
              </div>
            </div>
          )}

          {/* Active summary */}
          {activeCount > 0 && (
            <div className="mb-4 rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-3">
              <div className="text-xs font-medium text-orange-300 mb-1.5">Active — changing patient recommendations now</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(interventions)
                  .filter(([, sev]) => sev && sev !== "none")
                  .map(([key, sev]) => (
                    <span
                      key={key}
                      className={`px-2.5 py-0.5 rounded-full text-xs border ${SEVERITY_ACTIVE[sev as InterventionSeverity]}`}
                    >
                      {INTERVENTION_CONDITION_LABELS[key as InterventionConditionKey]} — {INTERVENTION_SEVERITY_LABELS[sev as InterventionSeverity]}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Tab nav */}
          <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
            {(
              [
                { key: "gi_symptoms",    label: "GI Symptoms"   },
                { key: "nutrition",      label: "Nutrition"     },
                { key: "weight_and_risk", label: "Weight & Risk" },
              ] as { key: TabKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === key
                    ? "bg-orange-600 text-white"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "gi_symptoms" && renderConditions(GI_CONDITIONS)}
          {activeTab === "nutrition"   && renderConditions(NUTRITION_CONDITIONS)}
          {activeTab === "weight_and_risk" && renderConditions(WEIGHT_CONDITIONS)}

          {/* Footer note */}
          <p className="mt-4 text-xs text-white/30 leading-relaxed">
            Selections save immediately and change what this patient receives across all meal builders,
            restaurant guides, recipe scan, and shopping lists — no additional steps required.
          </p>
        </div>
      )}
    </div>
  );
}
