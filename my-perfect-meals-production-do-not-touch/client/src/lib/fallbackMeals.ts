import { getWeekKey } from "@/hooks/useWeeklyPlan";

export function makeFallbackMeals(weekKey = getWeekKey(), mealsPerDay = 3) {
  const base = [
    { name: "Greek Yogurt & Berries", mealType: "breakfast" },
    { name: "Chicken, Rice & Greens", mealType: "lunch" },
    { name: "Salmon, Quinoa & Broccoli", mealType: "dinner" },
    { name: "Apple & Almonds", mealType: "snack" },
  ];
  const out: any[] = [];
  for (let d = 0; d < 7; d++) {
    for (let i = 0; i < mealsPerDay; i++) {
      const t = base[(i + d) % base.length];
      out.push({
        id: `${weekKey}-${d}-${i}-${t.mealType}`,
        name: t.name,
        mealType: (t.mealType as any) || "meal",
        dayIndex: d,
        calories: 450 + (i * 50),
        protein: 30 + (i * 5),
      });
    }
  }
  return out;
}