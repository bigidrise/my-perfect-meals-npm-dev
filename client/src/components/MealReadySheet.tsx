import React from "react";
import type { WeekBoard } from "@/../../shared/schema/weeklyBoard";

function countMeals(board: WeekBoard | null): number {
  if (!board) return 0;
  const slots = ["breakfast", "lunch", "dinner", "snacks"] as const;
  let total = 0;
  for (const day of Object.values(board.days || {})) {
    for (const slot of slots) {
      total += day[slot]?.length || 0;
    }
  }
  for (const slot of slots) {
    total += board.lists?.[slot]?.length || 0;
  }
  return total;
}

interface MealReadySheetProps {
  show: boolean;
  board: WeekBoard | null;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export default function MealReadySheet({
  show,
  board,
  onRefresh,
  onClose,
}: MealReadySheetProps) {
  const [busy, setBusy] = React.useState(false);

  const initialCountRef = React.useRef<number>(0);
  const latestCountRef = React.useRef<number>(0);

  React.useEffect(() => {
    latestCountRef.current = countMeals(board);
  }, [board]);

  React.useEffect(() => {
    if (show) {
      initialCountRef.current = countMeals(board);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleShowMyMeal = async () => {
    setBusy(true);
    const baseline = initialCountRef.current;
    let updated = false;
    try {
      await onRefresh();
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      updated = latestCountRef.current !== baseline;
    } catch {
      updated = false;
    } finally {
      setBusy(false);
    }
    if (updated) {
      onClose();
    } else {
      window.location.reload();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)", animation: "mealReadyPopIn 0.2s ease-out" }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-white text-base leading-snug">
                Your meal is ready
              </p>
              <p className="text-sm text-white/70 mt-0.5">
                If it doesn't appear automatically, tap below.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white ml-4 mt-0.5 shrink-0 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleShowMyMeal}
              disabled={busy}
              className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Loading…" : "Show My Meal"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-black bg-orange-400 hover:bg-orange-500 active:bg-orange-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes mealReadyPopIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
