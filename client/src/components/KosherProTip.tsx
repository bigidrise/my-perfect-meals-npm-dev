interface KosherProTipProps {
  dietClassification: string | null;
  isAdapted: boolean;
  className?: string;
}

const CERT_DIETS = new Set(["kosher", "halal"]);

export default function KosherProTip({
  dietClassification,
  isAdapted,
  className = "",
}: KosherProTipProps) {
  if (!dietClassification) return null;
  if (!CERT_DIETS.has(dietClassification.toLowerCase())) return null;

  const label = dietClassification.charAt(0).toUpperCase() + dietClassification.slice(1).toLowerCase();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-900/20 px-2 py-0.5 text-[10px] font-medium text-amber-300/80 ${className}`}
    >
      ⚠️ {label} certification required
      {isAdapted && " · recipe adapted"}
    </span>
  );
}
