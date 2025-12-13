type Reason = { label: string; tag?: "diet"|"portion"|"variety"|"time"|"staples"|"shopping"|"reset" };
type WhyDrawerProps = { open: boolean; onClose: () => void; title: string; reasons: Reason[] };

export function WhyDrawer({ open, onClose, title, reasons }: WhyDrawerProps) {
  if (!open) return null;
  
  return (
    <div role="dialog" className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur p-4 rounded-t-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white font-semibold mb-2">{title}</div>
        <ul className="space-y-1 text-sm text-white/80">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-white/60">•</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-right">
          <button 
            onClick={onClose} 
            className="text-xs px-3 py-1 rounded-md border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
            data-testid="why-drawer-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}