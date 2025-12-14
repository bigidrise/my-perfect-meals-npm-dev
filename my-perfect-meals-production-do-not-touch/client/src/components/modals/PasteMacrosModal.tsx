import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseMacrosFromText } from "@/utils/parseMacrosFromText";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: string;
};

function readStore() {
  try { return JSON.parse(localStorage.getItem("macros_offline_v1") || "{}"); } catch { return {}; }
}
function writeStore(s: any) {
  try { localStorage.setItem("macros_offline_v1", JSON.stringify(s)); } catch {}
}
function dayKey(d = new Date()) {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function mergeToday({ protein=0, carbs=0, fat=0, calories=0 }: { protein?:number; carbs?:number; fat?:number; calories?:number }) {
  const store = readStore();
  const key = dayKey();
  const rows: any[] = Array.isArray((store as any).rows) ? (store as any).rows : [];
  let row = rows.find(r => r.day === key);
  if (!row) { row = { day: key, kcal: 0, protein: 0, carbs: 0, fat: 0 }; rows.unshift(row); }
  row.protein = Math.round((row.protein || 0) + (protein || 0));
  row.carbs   = Math.round((row.carbs   || 0) + (carbs   || 0));
  row.fat     = Math.round((row.fat     || 0) + (fat     || 0));
  row.kcal    = Math.round((row.kcal    || 0) + (calories || 0));
  writeStore({ rows: rows.slice(0, 90) });
  window.dispatchEvent(new Event("macros:updated"));
  return row;
}

export default function PasteMacrosModal({ open, onOpenChange, initial }: Props) {
  const { toast } = useToast();
  const [text, setText] = useState(initial ?? "");
  const parsed = useMemo(() => parseMacrosFromText(text), [text]);

  const canAdd = (parsed.protein || 0) + (parsed.carbs || 0) + (parsed.fat || 0) > 0;

  // Universal cleaner for both paste and input
  function cleanMobileText(rawText: string): string {
    let cleaned = rawText;
    
    // Step 1: Replace ALL percent-encoded characters manually (decodeURIComponent can fail)
    cleaned = cleaned
      .replace(/%20/g, " ")      // spaces
      .replace(/%0A/g, "\n")     // newlines
      .replace(/%0D/g, "")       // carriage returns (remove)
      .replace(/%09/g, " ")      // tabs → spaces
      .replace(/%2C/g, ",")      // commas
      .replace(/%3A/g, ":")      // colons
      .replace(/%2F/g, "/")      // slashes
      .replace(/%3D/g, "=")      // equals
      .replace(/%25/g, "%")      // percent signs (do last)
      .replace(/%[0-9A-F]{2}/gi, ""); // Remove any other percent codes
    
    // Step 2: Remove HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, " "); // Remove any other HTML entities
    
    // Step 3: Clean up whitespace
    cleaned = cleaned
      .replace(/[\r\n]+/g, "\n")  // Normalize line breaks
      .replace(/[ \t]+/g, " ")    // Collapse spaces/tabs
      .replace(/\n\s+/g, "\n")    // Remove leading whitespace on lines
      .replace(/\s+\n/g, "\n")    // Remove trailing whitespace on lines
      .trim();
    
    return cleaned;
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain") || e.clipboardData.getData("text");
    setText(cleanMobileText(pastedText));
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    // Auto-clean if percent-encoded text is detected
    if (/%[0-9A-F]{2}/i.test(value)) {
      setText(cleanMobileText(value));
    } else {
      setText(value);
    }
  }

  function add() {
    mergeToday(parsed);
    onOpenChange(false);
    toast({ 
      title: "Macros added", 
      description: "Pasted macros applied to today." 
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white/5 backdrop-blur-2xl border border-white/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Paste Macros</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={handleChange}
            onPaste={handlePaste}
            placeholder={`Paste here, e.g.:\nProtein: 30 g\nCarbs: 40 g\nFat: 16 g\nCalories: 500`}
            className="min-h-[140px] bg-black/30 border-white/30 placeholder:text-white/50 text-white touch-manipulation"
            data-testid="textarea-paste-macros"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className="rounded-xl p-3 bg-black/20 border border-white/15 text-sm">
            <div className="flex justify-between"><span className="text-white/70">Protein</span><b>{parsed.protein ?? 0} g</b></div>
            <div className="flex justify-between"><span className="text-white/70">Carbs</span><b>{parsed.carbs ?? 0} g</b></div>
            <div className="flex justify-between"><span className="text-white/70">Fat</span><b>{parsed.fat ?? 0} g</b></div>
            <div className="flex justify-between"><span className="text-white/70">Calories</span><b>{parsed.calories ?? 0} kcal</b></div>
          </div>
          <p className="text-xs text-white/70">Tip: You can paste directly from Craving Creator or any meal card summary.</p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" className="border-white/30 text-white bg-white/10" onClick={() => onOpenChange(false)} data-testid="button-cancel-paste">Cancel</Button>
          <Button onClick={add} disabled={!canAdd} className="bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" data-testid="button-add-pasted-macros">
            Add to Today
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
