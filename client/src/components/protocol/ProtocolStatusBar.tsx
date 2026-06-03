import { useAuth } from "@/contexts/AuthContext";

type ThyroidType = "hypothyroid" | "hyperthyroid" | "hashimotos" | null;

interface ProtocolEntry {
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  dotGlow: string;
  detail?: string;
}

function buildProtocolEntries(
  specialtyConditions: string[],
  thyroidType: ThyroidType
): ProtocolEntry[] {
  const entries: ProtocolEntry[] = [];

  if (specialtyConditions.includes("thyroid-support")) {
    const subtypeMap: Record<string, string> = {
      hypothyroid: "Hypothyroid",
      hyperthyroid: "Hyperthyroid",
      hashimotos: "Hashimoto's",
    };
    const detail = thyroidType ? subtypeMap[thyroidType] : undefined;
    entries.push({
      key: "thyroid-support",
      label: "Thyroid Support",
      detail,
      color: "text-teal-300",
      bg: "bg-teal-900/30",
      border: "border-teal-500/40",
      dot: "bg-teal-400",
      dotGlow: "shadow-[0_0_5px_rgba(45,212,191,0.9)]",
    });
  }

  if (specialtyConditions.includes("hormone-optimization")) {
    entries.push({
      key: "hormone-optimization",
      label: "Hormone Optimization",
      color: "text-orange-300",
      bg: "bg-orange-900/20",
      border: "border-orange-500/40",
      dot: "bg-orange-400",
      dotGlow: "shadow-[0_0_5px_rgba(251,146,60,0.9)]",
    });
  }

  if (specialtyConditions.includes("oncology-support")) {
    entries.push({
      key: "oncology-support",
      label: "Oncology Support",
      color: "text-rose-300",
      bg: "bg-rose-900/30",
      border: "border-rose-500/40",
      dot: "bg-rose-400",
      dotGlow: "shadow-[0_0_5px_rgba(244,114,182,0.9)]",
    });
  }

  if (specialtyConditions.includes("renal")) {
    entries.push({
      key: "renal",
      label: "Kidney / Renal",
      color: "text-sky-300",
      bg: "bg-sky-900/30",
      border: "border-sky-500/40",
      dot: "bg-sky-400",
      dotGlow: "shadow-[0_0_5px_rgba(56,189,248,0.8)]",
    });
  }

  if (specialtyConditions.includes("cardiac")) {
    entries.push({
      key: "cardiac",
      label: "Cardiac Health",
      color: "text-red-300",
      bg: "bg-red-900/30",
      border: "border-red-500/40",
      dot: "bg-red-400",
      dotGlow: "shadow-[0_0_5px_rgba(248,113,113,0.8)]",
    });
  }

  if (specialtyConditions.includes("liver-support") || specialtyConditions.includes("liver-disease")) {
    const isDisease = specialtyConditions.includes("liver-disease");
    entries.push({
      key: "liver",
      label: isDisease ? "Liver Disease" : "Liver Support",
      color: isDisease ? "text-amber-300" : "text-emerald-300",
      bg: isDisease ? "bg-amber-900/30" : "bg-emerald-900/30",
      border: isDisease ? "border-amber-500/40" : "border-emerald-500/40",
      dot: isDisease ? "bg-amber-400" : "bg-emerald-400",
      dotGlow: isDisease
        ? "shadow-[0_0_5px_rgba(251,191,36,0.8)]"
        : "shadow-[0_0_5px_rgba(52,211,153,0.8)]",
    });
  }

  return entries;
}

interface ProtocolStatusBarProps {
  className?: string;
}

export default function ProtocolStatusBar({ className = "" }: ProtocolStatusBarProps) {
  const { user } = useAuth();

  const specialtyConditions: string[] =
    ((user as any)?.specialtyConditions as string[] | undefined) ?? [];
  const thyroidType: ThyroidType =
    ((user as any)?.thyroidType as ThyroidType) ?? null;

  const entries = buildProtocolEntries(specialtyConditions, thyroidType);

  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {entries.map((e) => (
        <div
          key={e.key}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${e.bg} ${e.border} ${e.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.dot} ${e.dotGlow}`} />
          <span>{e.label}</span>
          {e.detail && (
            <span className="opacity-60 font-normal">· {e.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}
