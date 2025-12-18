import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getDayNameLong, formatDateShort } from "@/utils/week";

interface DuplicateDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetDates: string[]) => void;
  sourceDateISO: string;
  availableDates: string[]; // The other 6 days in the week
}

export function DuplicateDayModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  sourceDateISO, 
  availableDates 
}: DuplicateDayModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const handleToggleDate = (dateISO: string) => {
    setSelectedDates(prev => {
      const updated = prev.includes(dateISO)
        ? prev.filter(d => d !== dateISO)
        : [...prev, dateISO];
      
      // Dispatch walkthrough event when days are selected
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

  const handleSelectAll = () => {
    setSelectedDates(availableDates);
    
    // Dispatch walkthrough event
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
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedDates([]);
    onClose();
  };

  const sourceDayName = getDayNameLong(sourceDateISO);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-black/90 via-gray-800/90 to-black/90 border border-white/20 text-white max-w-md" data-testid="duplicate-days-panel">
        {/* Hidden event emitter for walkthrough system */}
        <div data-testid="duplicate-days-selected" style={{display: 'none'}} />
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Duplicate {sourceDayName}
          </DialogTitle>
          <p className="text-white/70 text-sm">
            Copy all meals from {sourceDayName} to other days. This will replace any existing meals on the selected days.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {availableDates.map((dateISO) => {
              const isSelected = selectedDates.includes(dateISO);
              const dayName = getDayNameLong(dateISO);
              const dateShort = formatDateShort(dateISO);

              return (
                <div
                  key={dateISO}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <Checkbox
                    id={dateISO}
                    checked={isSelected}
                    onCheckedChange={() => handleToggleDate(dateISO)}
                    className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label htmlFor={dateISO} className="flex-1 cursor-pointer">
                    <div className="font-medium text-white">{dayName}</div>
                    <div className="text-sm text-white/60">{dateShort}</div>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedDates.length === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:opacity-50"
            data-testid="duplicate-confirm-button"
          >
            Duplicate to {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}