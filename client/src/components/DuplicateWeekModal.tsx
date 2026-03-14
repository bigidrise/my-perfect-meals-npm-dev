import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWeekRange, getWeekStartISO } from "@/utils/week";
import { isoToUtcNoonDate } from "@/utils/midnight";
import { RefreshCw, CheckCircle, Loader2 } from "lucide-react";

interface DuplicateWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetWeekStartISO: string) => Promise<void> | void;
  sourceWeekStartISO: string;
}

type Status = "idle" | "loading" | "success" | "error";

export function DuplicateWeekModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  sourceWeekStartISO 
}: DuplicateWeekModalProps) {
  const [targetDate, setTargetDate] = useState(getWeekStartISO());
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isValidMonday = (dateISO: string): boolean => {
    if (!dateISO) return false;
    try {
      const date = isoToUtcNoonDate(dateISO);
      return date.getUTCDay() === 1;
    } catch {
      return false;
    }
  };

  const handleConfirm = async () => {
    if (!targetDate || targetDate === sourceWeekStartISO || !isValidMonday(targetDate)) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await onConfirm(targetDate);
      setStatus("success");
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setErrorMsg("");
    onClose();
  };

  const sourceWeekLabel = formatWeekRange(sourceWeekStartISO);
  const targetWeekLabel = targetDate ? formatWeekRange(targetDate) : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-black/90 via-gray-800/90 to-black/90 border border-white/20 text-white max-w-md">
        {status === "success" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
                Week Duplicated!
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <p className="text-white/80 text-sm">
                Your meals have been copied to <span className="text-white font-medium">{targetWeekLabel}</span>. Press <strong>Refresh Now</strong> to load the new week.
              </p>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Close
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Now
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">
                Duplicate Week
              </DialogTitle>
              <p className="text-white/70 text-sm">
                Copy all 7 days from the current week to another week. This will replace any existing meals in the target week.
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="text-sm font-medium text-blue-300">Source Week</div>
                <div className="text-white">{sourceWeekLabel}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-date" className="text-white">
                  Target Week Start (must be a Monday)
                </Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-black/40 border-white/20 text-white"
                />
                {targetDate && !isValidMonday(targetDate) && (
                  <div className="text-red-400 text-xs">
                    Please select a Monday as the week start date.
                  </div>
                )}
                {targetWeekLabel && isValidMonday(targetDate) && (
                  <div className="text-sm text-white/70">
                    Will copy to: {targetWeekLabel}
                  </div>
                )}
              </div>

              {targetDate === sourceWeekStartISO && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="text-sm text-amber-300">
                    Target week is the same as source week
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm text-red-300">{errorMsg}</div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={status === "loading"}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!targetDate || targetDate === sourceWeekStartISO || !isValidMonday(targetDate) || status === "loading"}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:opacity-50 flex items-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Duplicating...
                  </>
                ) : (
                  "Duplicate Week"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
