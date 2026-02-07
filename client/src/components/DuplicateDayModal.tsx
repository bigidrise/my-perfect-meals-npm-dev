import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getDayNameLong, formatDateShort, formatWeekRange } from "@/utils/week";
import { getTodayISOSafe, weekDatesInTZ, getWeekStartFromDate, addDaysISOSafe, nextWeekISO } from "@/utils/midnight";
import { ChevronRight, Plus } from "lucide-react";

const TZ = "America/Chicago";
const MAX_FORWARD_WEEKS = 4;

interface DuplicateDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetDates: string[]) => void;
  sourceDateISO: string;
  availableDates: string[];
}

interface WeekGroup {
  weekStartISO: string;
  label: string;
  dates: string[];
  isCurrent: boolean;
}

export function DuplicateDayModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  sourceDateISO, 
  availableDates 
}: DuplicateDayModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [weeksToShow, setWeeksToShow] = useState(0);

  const todayISO = useMemo(() => getTodayISOSafe(TZ), []);

  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: WeekGroup[] = [];
    const sourceWeekStart = getWeekStartFromDate(sourceDateISO, TZ);
    const todayWeekStart = getWeekStartFromDate(todayISO, TZ);

    const currentWeekDates = availableDates.filter(d => d >= todayISO && d !== sourceDateISO);
    if (currentWeekDates.length > 0) {
      groups.push({
        weekStartISO: sourceWeekStart,
        label: "This Week",
        dates: currentWeekDates,
        isCurrent: true,
      });
    }

    const firstFutureWeek = sourceWeekStart >= todayWeekStart
      ? nextWeekISO(sourceWeekStart, TZ)
      : nextWeekISO(todayWeekStart, TZ);

    let nextStart = firstFutureWeek;
    for (let i = 0; i < weeksToShow; i++) {
      const weekDates = weekDatesInTZ(nextStart, TZ).filter(d => d >= todayISO);
      if (weekDates.length > 0) {
        groups.push({
          weekStartISO: nextStart,
          label: formatWeekRange(nextStart),
          dates: weekDates,
          isCurrent: false,
        });
      }
      nextStart = nextWeekISO(nextStart, TZ);
    }

    return groups;
  }, [sourceDateISO, availableDates, todayISO, weeksToShow]);

  const allAvailableDates = useMemo(() => {
    return weekGroups.flatMap(g => g.dates);
  }, [weekGroups]);

  const handleToggleDate = (dateISO: string) => {
    setSelectedDates(prev => {
      const updated = prev.includes(dateISO)
        ? prev.filter(d => d !== dateISO)
        : [...prev, dateISO];
      
      if (updated.length > 0) {
        setTimeout(() => {
          const eventTarget = document.querySelector(`[data-testid="duplicate-days-selected"]`);
          if (eventTarget) {
            eventTarget.dispatchEvent(new CustomEvent('chosen'));
          }
        }, 100);
      }
      
      return updated;
    });
  };

  const handleToggleWeek = (weekDates: string[]) => {
    setSelectedDates(prev => {
      const allSelected = weekDates.every(d => prev.includes(d));
      if (allSelected) {
        return prev.filter(d => !weekDates.includes(d));
      } else {
        const combined = new Set([...prev, ...weekDates]);
        return Array.from(combined);
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedDates(allAvailableDates);
    
    setTimeout(() => {
      const eventTarget = document.querySelector(`[data-testid="duplicate-days-selected"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('chosen'));
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
      setWeeksToShow(0);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedDates([]);
    setWeeksToShow(0);
    onClose();
  };

  const canAddMoreWeeks = weeksToShow < MAX_FORWARD_WEEKS;

  const sourceDayName = getDayNameLong(sourceDateISO);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-black/90 via-gray-800/90 to-black/90 border border-white/20 text-white max-w-md" data-testid="duplicate-days-panel">
        <div data-testid="duplicate-days-selected" style={{display: 'none'}} />
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Duplicate {sourceDayName}
          </DialogTitle>
          <p className="text-white/70 text-sm">
            Copy all meals from {sourceDayName} to selected days. You can duplicate across multiple weeks going forward.
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

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {weekGroups.map((group) => {
              const weekAllSelected = group.dates.every(d => selectedDates.includes(d));
              const weekSomeSelected = group.dates.some(d => selectedDates.includes(d));

              return (
                <div key={group.weekStartISO} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleToggleWeek(group.dates)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md bg-white/5 text-left"
                  >
                    <Checkbox
                      checked={weekAllSelected ? true : weekSomeSelected ? "indeterminate" : false}
                      onCheckedChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 pointer-events-none"
                    />
                    <span className="text-sm font-semibold text-blue-300">
                      {group.label}
                    </span>
                    <span className="text-xs text-white/40 ml-auto">
                      {group.dates.length} days
                    </span>
                  </button>

                  <div className="space-y-1 pl-2">
                    {group.dates.map((dateISO) => {
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
              );
            })}

            {canAddMoreWeeks && (
              <button
                type="button"
                onClick={() => setWeeksToShow(prev => prev + 1)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-white/20 text-white/60 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Another Week
              </button>
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
            Duplicate to {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
