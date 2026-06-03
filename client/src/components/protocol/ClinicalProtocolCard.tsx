import PillButton from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type ThyroidSubtype = "hypothyroid" | "hyperthyroid" | "hashimotos";

interface ClinicalProtocolCardProps {
  clientUserId: string | number;
  specialtyConditions: string[];
  thyroidType?: ThyroidSubtype | null;
  thyroidMedication?: string | null;
  onUpdate?: () => void;
}

const THYROID_SUBTYPES: { label: string; value: ThyroidSubtype }[] = [
  { label: "Hypothyroid", value: "hypothyroid" },
  { label: "Hyperthyroid", value: "hyperthyroid" },
  { label: "Hashimoto's", value: "hashimotos" },
];

export default function ClinicalProtocolCard({
  clientUserId,
  specialtyConditions,
  thyroidType: initialThyroidType = null,
  thyroidMedication,
  onUpdate,
}: ClinicalProtocolCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localThyroidType, setLocalThyroidType] = useState<ThyroidSubtype | null>(
    initialThyroidType ?? null
  );

  const hasThyroid = specialtyConditions.includes("thyroid-support");
  const hasHormone = specialtyConditions.includes("hormone-optimization");
  const hasOncology = specialtyConditions.includes("oncology-support");
  const hasRenal = specialtyConditions.includes("renal");
  const hasCardiac = specialtyConditions.includes("cardiac");
  const hasLiver =
    specialtyConditions.includes("liver-support") ||
    specialtyConditions.includes("liver-disease");

  const activeCount = [hasThyroid, hasHormone, hasOncology, hasRenal, hasCardiac, hasLiver].filter(
    Boolean
  ).length;

  const handleSaveThyroidSubtype = async (subtype: ThyroidSubtype | null) => {
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(`/api/pro/thyroid-type/${clientUserId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ thyroidType: subtype }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      setLocalThyroidType(subtype);
      onUpdate?.();
      toast({ title: "Thyroid subtype updated" });
    } catch {
      toast({ title: "Could not save thyroid subtype", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHormone = async (active: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(`/api/pro/hormone-optimization/${clientUserId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ active }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      onUpdate?.();
      toast({ title: active ? "Hormone Optimization assigned" : "Hormone Optimization removed" });
    } catch {
      toast({ title: "Could not update hormone optimization", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Active Clinical Protocols</h3>
        <span className="text-xs text-white/40">
          {activeCount === 0 ? "None active" : `${activeCount} active`}
        </span>
      </div>

      {activeCount === 0 && (
        <p className="text-xs text-white/40 italic">
          No specialty protocols are currently active for this patient.
        </p>
      )}

      {hasThyroid && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-900/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_5px_rgba(45,212,191,0.9)] shrink-0" />
            <span className="text-teal-300 text-xs font-semibold">Thyroid Support</span>
            {thyroidMedication && (
              <span className="ml-auto text-[10px] text-white/40 italic truncate max-w-[140px]">
                {thyroidMedication}
              </span>
            )}
          </div>
          <div>
            <p className="text-white/50 text-[10px] mb-1.5">
              Subtype — narrows guidance blocks at generation time
            </p>
            <div className="flex flex-wrap gap-1.5">
              {THYROID_SUBTYPES.map((opt) => (
                <PillButton
                  key={opt.value}
                  active={localThyroidType === opt.value}
                  disabled={saving}
                  onClick={() =>
                    handleSaveThyroidSubtype(
                      localThyroidType === opt.value ? null : opt.value
                    )
                  }
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasOncology && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-900/20 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_5px_rgba(244,114,182,0.9)] shrink-0" />
          <span className="text-rose-300 text-xs font-semibold">Oncology Support</span>
          <span className="ml-auto text-[10px] text-white/40 italic">Physician-assigned</span>
        </div>
      )}

      {hasRenal && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-900/20 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_5px_rgba(56,189,248,0.8)] shrink-0" />
          <span className="text-sky-300 text-xs font-semibold">Kidney / Renal</span>
        </div>
      )}

      {hasCardiac && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-900/20 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.8)] shrink-0" />
          <span className="text-red-300 text-xs font-semibold">Cardiac Health</span>
        </div>
      )}

      {hasLiver && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-900/20 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] shrink-0" />
          <span className="text-amber-300 text-xs font-semibold">
            {specialtyConditions.includes("liver-disease") ? "Liver Disease" : "Liver Support"}
          </span>
        </div>
      )}

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/80">Hormone Optimization</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              Healthy fats · zinc-rich proteins · no refined sugars
            </p>
          </div>
          <PillButton
            active={hasHormone}
            disabled={saving}
            onClick={() => handleToggleHormone(!hasHormone)}
          >
            {hasHormone ? "Active" : "Assign"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
