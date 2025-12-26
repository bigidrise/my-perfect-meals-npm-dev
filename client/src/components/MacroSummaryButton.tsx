import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { sumMacroNumbers, roundTotals, formatClipboard, type MacroNumbers } from "@/utils/macros";
import { ClipboardCopy } from "lucide-react";

type Props = {
  label?: string;
  title?: string;
  nutrition?: MacroNumbers;
  items?: MacroNumbers[];
  colorVariant?: "blue" | "default";
};

export default function MacroSummaryButton({ label="Show Macros", title, nutrition, items, colorVariant = "default" }: Props) {
  const [open, setOpen] = useState(false);

  const totals = useMemo(() => {
    if (items && items.length) return sumMacroNumbers(items);
    return roundTotals(nutrition || {});
  }, [nutrition, items]);

  const copyText = formatClipboard(totals);

  const buttonClassName = colorVariant === "blue" 
    ? "flex-1 bg-blue-600/80 hover:bg-blue-700/80 border border-blue-500/50 text-white"
    : "bg-white/10 border border-white/30 hover:bg-white/20 text-white";

  return (
    <>
      <Button
        data-testid="button-show-macros"
        onClick={() => setOpen(true)}
        className={buttonClassName}
        size="sm"
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white/5 backdrop-blur-2xl border border-white/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{title ? `Macros for ${title}` : "Macros Summary"}</DialogTitle>
          </DialogHeader>

          <div className="rounded-xl p-4 bg-black/30 border border-white/15 space-y-1">
            <Row k="Calories" v={`${totals.calories} kcal`} />
            <Row k="Protein*"  v={`${totals.protein} g`} />
            <Row k="Carbs*"    v={`${totals.carbs} g`} />
            <Row k="Fat"      v={`${totals.fat} g`} />
          </div>

          <p className="text-xs text-white/70">
            <b>Copy & Paste:</b> Click Copy, then open Quick Add on My Biometrics and paste.<br/>
            <b>Manual Transfer:</b> Click "Go to My Biometrics" and enter these numbers manually. (Calories auto-calculated with 4/4/9.)
          </p>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button 
              data-testid="button-copy-macros"
              onClick={async () => {
                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(copyText);
                  } else {
                    // Fallback for older mobile browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = copyText; // Use plain text, NOT encoded
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                  }
                } catch (err) {
                  console.error('Copy failed:', err);
                }
              }} 
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <ClipboardCopy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button 
              data-testid="button-go-biometrics"
              onClick={() => (window.location.href = "/my-biometrics")} 
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Go to My Biometrics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-sm"><span className="text-white/80">{k}</span><span className="font-semibold">{v}</span></div>;
}
