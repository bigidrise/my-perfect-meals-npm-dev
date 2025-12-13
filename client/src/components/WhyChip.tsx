type WhyChipProps = { onOpen: () => void; label?: string };

export function WhyChip({ onOpen, label = "ⓘ Why" }: WhyChipProps) {
  return (
    <button onClick={onOpen}
      className="text-xs px-2 py-1 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
      data-testid="why-chip"
    >
      {label}
    </button>
  );
}