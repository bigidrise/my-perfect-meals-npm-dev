import { useState } from "react";
import AddToBoardModal from "@/components/AddToBoardModal";
import { addMealToBoard, type ListType } from "@/utils/addMealToBoard";
import { getCurrentWeekBoard } from "@/lib/boardApi";
import { useLocation } from "wouter";

export default function AddToBoardButton({
  meal,                // the meal object from Fridge Rescue card
  defaultList = "dinner",
  enableDayPlanning = true,   // set false if you haven't enabled day-by-day yet
  onDone,              // optional callback after success
}: {
  meal: any;
  defaultList?: ListType;
  enableDayPlanning?: boolean;
  onDone?: (info: { weekStartISO: string; dateISO: string | null; list: ListType }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  async function handleConfirm(p: { dateISO: string | null; list: ListType }) {
    // ensure we know which week we're adding to
    const { weekStartISO } = await getCurrentWeekBoard();
    await addMealToBoard({
      sourceMeal: meal,
      list: p.list,
      dateISO: p.dateISO,
      weekStartISO,
    });
    
    // Close the modal first
    setOpen(false);
    
    // Call optional callback
    onDone?.({ weekStartISO, dateISO: p.dateISO, list: p.list });
    
    // Navigate to weekly meal board to show the added meal
    setLocation("/weekly-meal-board");
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="w-full min-h-12 rounded-md px-3 py-2 text-sm font-semibold bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 transition-colors flex items-center justify-center text-center leading-tight"
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto' }}
      >
        + Weekly Board
      </button>

      <AddToBoardModal
        open={open}
        onClose={() => setOpen(false)}
        weekStartISO={(window as any).__wkISO__ ?? new Date().toISOString().slice(0,10)} // harmless fallback
        enableDayPlanning={enableDayPlanning}
        defaultList={defaultList}
        onConfirm={handleConfirm}
      />
    </>
  );
}
