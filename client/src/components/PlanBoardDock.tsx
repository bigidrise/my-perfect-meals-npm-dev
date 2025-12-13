
import React from "react";
import { Button } from "@/components/ui/button";
import { useCurrentBoard, useAddBoardItem, useDeleteBoardItem, useCommitBoard } from "@/hooks/useMealBoard";

type Props = {
  userId: string;
  program: "glp1" | "smart" | "medical" | "diabetic";
  days?: 3 | 7;
  startISO?: string;
};

export default function PlanBoardDock({ userId, program, days = 7, startISO }: Props) {
  const { data, isLoading } = useCurrentBoard(userId, program, startISO, days);
  const addM = useAddBoardItem();
  const commitM = useCommitBoard(data?.board.id ?? "");
  
  if (isLoading || !data) return null;

  const { board, items } = data;
  const byDay = Array.from({ length: board.days }, (_, d) => ({
    dayIndex: d,
    items: items.filter(i => i.dayIndex === d),
  }));

  // Helper function exposed globally for meal cards
  const addMeal = (p: {
    dayIndex: number;
    slot: "breakfast" | "lunch" | "dinner" | "snack";
    mealId: string;
    title: string;
    servings?: number;
    macros: { kcal: number; protein: number; carbs: number; fat: number };
    ingredients?: Array<{ name: string; qty: string }>;
  }) => {
    addM.mutate({
      boardId: board.id,
      dayIndex: p.dayIndex,
      slot: p.slot,
      mealId: p.mealId,
      title: p.title,
      servings: p.servings ?? 1,
      macros: p.macros,
      ingredients: p.ingredients ?? []
    });
  };

  React.useEffect(() => {
    (window as any).__addToPlanBoard = addMeal;
  }, [board.id]);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/20 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-white">{board.title}</div>
        <Button
          size="sm"
          onClick={() => commitM.mutate({ scope: "week" })}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Post Week
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {byDay.map(({ dayIndex, items }) => (
          <div key={dayIndex} className="rounded-xl bg-black/30 border border-white/10 p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/70">Day {dayIndex + 1}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => commitM.mutate({ scope: "day", dayIndex })}
                className="h-6 px-2 text-xs"
              >
                Post
              </Button>
            </div>
            {(["breakfast", "lunch", "dinner", "snack"] as const).map(slot => (
              <div key={slot} className="mb-1">
                <div className="text-[10px] uppercase opacity-60 text-white/60">{slot}</div>
                <div className="space-y-1">
                  {items.filter(i => i.slot === slot).map(i => (
                    <div key={i.id} className="text-xs bg-white/5 border border-white/10 rounded p-1">
                      <div className="truncate text-white">{i.title}</div>
                      <div className="text-[10px] opacity-60 text-white/60">
                        {Math.round(i.macros.kcal)} kcal • {Math.round(i.macros.protein)}g P
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
