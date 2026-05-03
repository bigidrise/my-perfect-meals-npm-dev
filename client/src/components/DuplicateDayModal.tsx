import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getDayNameLong, formatDateShort } from "@/utils/week";
import { getTodayISOSafe, getWeekStartFromDate } from "@/utils/midnight";

const TZ = "America/Chicago";

interface DuplicateDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetDates: string[]) => void;
  sourceDateISO: string;
  availableDates: string[];
}

export function DuplicateDayModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  sourceDateISO, 
  availableDates 
}: DuplicateDayModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const todayISO = useMemo(() => getTodayISOSafe(TZ), []);

  const targetDates = useMemo(() => {
    return availableDates.filter((d) => d !== sourceDateISO);
  }, [sourceDateISO, availableDates]);

  const sourceWeekStart = useMemo(() => getWeekStartFromDate(sourceDateISO, TZ), [sourceDateISO]);

  const groupedDates = useMemo(() => {
    const groups: { weekStart: string; dates: string[] }[] = [];
    const seen = new Map<string, string[]>();
    for (const d of targetDates) {
      const ws = getWeekStartFromDate(d, TZ);
      if (!seen.has(ws)) seen.set(ws, []);
      seen.get(ws)!.push(d);
    }
    seen.forEach((dates, ws) => groups.push({ weekStart: ws, dates }));
    groups.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return groups;
  }, [targetDates]);

  const handleToggleDate = (dateISO: string) => {
    setSelectedDates((prev) => {
      const updated = prev.includes(dateISO)
        ? prev.filter((d) => d !== dateISO)
        : [...prev, dateISO];

      if (updated.length > 0) {
        setTimeout(() => {
          const eventTarget = document.querySelector(`[data-testid="duplicate-days-selected"]`);
          if (eventTarget) {
            eventTarget.dispatchEvent(new CustomEvent("chosen"));
          }
        }, 100);
      }

      return updated;
    });
  };

  const handleSelectAll = () => {
    setSelectedDates(targetDates);
    setTimeout(() => {
      const eventTarget = document.querySelector(`[data-testid="duplicate-days-selected"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent("chosen"));
      }
    }, 100);
  };

  const handleDeselectAll = () => {
    setSelectedDates([]);
  };

  const handleConfirm = () => {
    if (selectedDates.length > 0) {
      onConfirm(selectedDates);
      setSelectedDates([]);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedDates([]);
    onClose();
  };

  const sourceDayName = getDayNameLong(sourceDateISO);

  const weekGroupLabel = (weekStart: string): string => {
    if (weekStart === sourceWeekStart) return "This Week";
    const nextWeekMs = new Date(sourceWeekStart + "T12:00:00Z").getTime() + 7 * 86400000;
    const nextWeekISO = new Date(nextWeekMs).toISOString().slice(0, 10);
    if (weekStart === nextWeekISO) return "Next Week";
    return `Week of ${formatDateShort(weekStart)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-black/90 via-gray-800/90 to-black/90 border border-white/20 text-white max-w-md" data-testid="duplicate-days-panel">
        <div data-testid="duplicate-days-selected" style={{ display: "none" }} />
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Duplicate {sourceDayName}
          </DialogTitle>
          <p className="text-white/70 text-sm">
            Copy all meals from {sourceDayName} to any other day.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="bg-white/10 border-white/20 text-white"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="bg-white/10 border-white/20 text-white"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {targetDates.length === 0 ? (
              <div className="text-white/50 text-sm text-center py-4">
                No other days available.
              </div>
            ) : (
              groupedDates.map(({ weekStart, dates }) => (
                <div key={weekStart}>
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-2 px-1">
                    {weekGroupLabel(weekStart)}
                  </p>
                  <div className="space-y-2">
                    {dates.map((dateISO) => {
                      const isSelected = selectedDates.includes(dateISO);
                      const dayName = getDayNameLong(dateISO);
                      const dateShort = formatDateShort(dateISO);
                      const isToday = dateISO === todayISO;

                      return (
                        <div
                          key={dateISO}
                          className="flex items-center space-x-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
                        >
                          <Checkbox
                            id={dateISO}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleDate(dateISO)}
                            className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <label htmlFor={dateISO} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">{dayName}</span>
                              {isToday && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-green-600/30 text-green-300 rounded-full font-medium">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/60">{dateShort}</div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedDates.length === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white disabled:opacity-50"
            data-testid="duplicate-confirm-button"
          >
            Duplicate to {selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
