import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { sumMacroNumbers, formatClipboard, type MacroNumbers } from "@/utils/macros";

type Props = {
  title?: string;
  items: MacroNumbers[];
};

export default function MacroAggregateBar({ title="Totals", items }: Props) {
  const totals = useMemo(() => sumMacroNumbers(items || []), [items]);
  const text = formatClipboard(totals);

  return (
    <div className="sticky bottom-3 z-40 max-w-6xl mx-auto">
      <div className="rounded-2xl p-4 bg-white/10 border border-white/25 backdrop-blur-2xl text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-white/70">{title}</div>
            <div className="flex gap-4 text-sm mt-1 flex-wrap">
              <Pill label="Calories" value={`${totals.calories} kcal`} />
              <Pill label="Protein*"  value={`${totals.protein} g`} />
              <Pill label="Carbs*" value={`${totals.carbs} g`} />
              <Pill label="Fat"      value={`${totals.fat} g`} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              data-testid="button-copy-aggregate"
              onClick={() => navigator.clipboard.writeText(text)} 
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Copy Totals
            </Button>
            <Button 
              data-testid="button-go-biometrics-aggregate"
              onClick={() => (window.location.href = "/my-biometrics")} 
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Go to My Biometrics
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/70">Copy these and paste into Quick Add on My Biometrics.</p>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1 rounded-lg bg-black/30 border border-white/15">
      <span className="text-white/70 mr-2">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
