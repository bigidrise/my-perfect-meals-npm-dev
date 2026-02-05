import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Scale, Calendar as CalIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

type Method = "DEXA" | "BodPod" | "Calipers" | "Smart Scale" | "Other";

interface BodyCompositionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function BodyCompositionSheet({
  open,
  onOpenChange,
  onSaved,
}: BodyCompositionSheetProps) {
  const { toast } = useToast();
  const [method, setMethod] = useState<Method>("DEXA");
  const [date, setDate] = useState<string>("");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [goalBodyFatPct, setGoalBodyFatPct] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const user = getCurrentUser();
  const userId = user?.id;

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0]);
      loadLatestGoal();
    }
  }, [open]);

  const loadLatestGoal = async () => {
    if (!userId) return;
    try {
      const res = await fetch(apiUrl(`/api/users/${userId}/body-composition/latest`));
      if (res.ok) {
        const data = await res.json();
        if (data.entry?.goalBodyFatPct) {
          setGoalBodyFatPct(data.entry.goalBodyFatPct);
        }
      }
    } catch (err) {
      console.error("Error loading latest goal:", err);
    }
  };

  const toNumber = (v: string) => (v ? Number(v) : NaN);

  const save = async () => {
    if (!userId) {
      toast({
        title: "Not logged in",
        description: "Please log in to save your body composition data.",
        variant: "destructive",
      });
      return;
    }

    const bf = toNumber(bodyFatPct);
    if (!isFinite(bf) || bf < 1 || bf > 70) {
      toast({
        title: "Invalid body fat",
        description: "Body fat percentage must be between 1% and 70%.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const goal = toNumber(goalBodyFatPct);
      const payload: Record<string, unknown> = {
        currentBodyFatPct: bf.toString(),
        scanMethod: method,
        source: "client",
        recordedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
      };

      if (isFinite(goal) && goal >= 1 && goal <= 70) {
        payload.goalBodyFatPct = goal.toString();
      }

      const res = await fetch(apiUrl(`/api/users/${userId}/body-composition`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      toast({
        title: "Saved",
        description: "Body composition recorded successfully.",
      });

      setBodyFatPct("");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Error saving body composition:", err);
      toast({
        title: "Save failed",
        description: "Could not save your body composition data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/20 text-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white flex items-center gap-2 text-xl">
            <Scale className="h-5 w-5 text-blue-400" />
            Record Body Composition
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          <div className="space-y-2">
            <label className="text-sm text-white/85 font-medium">Body Fat %</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 18.5"
              value={bodyFatPct}
              onChange={(e) => setBodyFatPct(e.target.value)}
              className="bg-black/40 border-white/20 text-white text-lg h-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/85 font-medium">Goal Body Fat % (optional)</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 15"
              value={goalBodyFatPct}
              onChange={(e) => setGoalBodyFatPct(e.target.value)}
              className="bg-black/40 border-white/20 text-white h-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/85 font-medium">Scan Method</label>
            <Select value={method} onValueChange={(v: Method) => setMethod(v)}>
              <SelectTrigger className="bg-black/40 border-white/20 text-white h-12">
                <SelectValue placeholder="Pick a method" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 text-white border border-white/20">
                {["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/85 font-medium">Date</label>
            <div className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-white/60" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-black/40 border-white/20 text-white h-12"
              />
            </div>
          </div>

          <Button
            onClick={save}
            disabled={isSaving || !bodyFatPct}
            className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white mt-4"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
