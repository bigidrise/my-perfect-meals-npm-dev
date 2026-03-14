import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWeekRange, getWeekStartISO } from "@/utils/week";
import { isoToUtcNoonDate } from "@/utils/midnight";
import { RefreshCw, Loader2, X } from "lucide-react";

interface DuplicateWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetWeekStartISO: string) => Promise<void> | void;
  sourceWeekStartISO: string;
}

export function DuplicateWeekModal({
  isOpen,
  onClose,
  onConfirm,
  sourceWeekStartISO,
}: DuplicateWeekModalProps) {
  const [targetDate, setTargetDate] = useState(getWeekStartISO());
  const [loading, setLoading] = useState(false);
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);

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
    setLoading(true);
    try {
      await onConfirm(targetDate);
      onClose();
      setShowRefreshBanner(true);
    } finally {
      setLoading(false);
    }
  };

  const sourceWeekLabel = formatWeekRange(sourceWeekStartISO);
  const targetWeekLabel = targetDate ? formatWeekRange(targetDate) : "";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gradient-to-br from-black/90 via-gray-800/90 to-black/90 border border-white/20 text-white max-w-md">
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
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                !targetDate ||
                targetDate === sourceWeekStartISO ||
                !isValidMonday(targetDate) ||
                loading
              }
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Duplicating...
                </>
              ) : (
                "Duplicate Week"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showRefreshBanner &&
        createPortal(
          <div className="fixed top-0 left-0 right-0 z-[9999] px-4 pt-4">
            <div className="bg-black/80 border border-white/20 backdrop-blur-sm rounded-2xl shadow-xl px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex-1 text-white text-sm">
                <span className="font-semibold">Week duplicated</span>
                {targetWeekLabel && (
                  <span className="text-white/60"> · {targetWeekLabel}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => window.location.reload()}
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium flex items-center gap-1.5 min-h-[36px] px-4"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <button
                  onClick={() => setShowRefreshBanner(false)}
                  className="text-white/60 hover:text-white p-1.5"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
