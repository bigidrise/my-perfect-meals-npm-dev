interface KosherProTipProps {
  dietClassification: string | null;
  isAdapted: boolean;
}

const CERT_CONFIG: Record<string, { label: string; tip: string; colors: string }> = {
  kosher: {
    label: "Kosher",
    tip: "This meal was generated to meet kosher dietary standards. Verify ingredients with your local certification authority.",
    colors: "border-amber-500/30 bg-amber-950/20 text-amber-300/80",
  },
  halal: {
    label: "Halal",
    tip: "This meal was generated to meet halal dietary standards. Verify ingredients and sourcing with your local authority.",
    colors: "border-teal-500/30 bg-teal-950/20 text-teal-300/80",
  },
};

export default function KosherProTip({ dietClassification, isAdapted }: KosherProTipProps) {
  if (!dietClassification) return null;
  const config = CERT_CONFIG[dietClassification.toLowerCase()];
  if (!config) return null;

  return (
    <div className={`mt-1 rounded-lg border px-3 py-2 text-[11px] leading-snug ${config.colors}`}>
      <span className="font-semibold">{config.label} note: </span>
      {isAdapted
        ? `This meal was adapted to meet ${config.label.toLowerCase()} requirements. Always confirm with your certification authority.`
        : config.tip}
    </div>
  );
}
