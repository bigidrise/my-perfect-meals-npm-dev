import * as React from "react";
import type { MacroItem, Preset } from "@/types/macro";
import { kcal } from "@/utils/macros";

const STORAGE_KEY = "macro-counter-v1";

export function useMacroCounter() {
  const [items, setItems] = React.useState<MacroItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as MacroItem[]) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const addPreset = React.useCallback((p: Preset) => {
    setItems((prev) => [
      ...prev,
      {
        id: `${p.id}-${Date.now()}`,
        name: p.name,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        qty: 1,
      },
    ]);
  }, []);

  const addCustom = React.useCallback(
    (name: string, protein: number, carbs: number, fat: number, qty = 1) => {
      if (!name.trim()) return;
      setItems((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          name: name.trim(),
          protein,
          carbs,
          fat,
          qty,
        },
      ]);
    },
    [],
  );

  const updateQty = React.useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(0, qty) } : it)),
    );
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    if (confirm("Clear all entries?")) setItems([]);
  }, []);

  const totals = React.useMemo(() => {
    const sum = items.reduce(
      (acc, it) => {
        acc.p += it.protein * it.qty;
        acc.c += it.carbs * it.qty;
        acc.f += it.fat * it.qty;
        return acc;
      },
      { p: 0, c: 0, f: 0 },
    );
    const calories = kcal(sum.p, sum.c, sum.f);
    const pct =
      calories > 0
        ? {
            p: Math.round(((sum.p * 4) / calories) * 100),
            c: Math.round(((sum.c * 4) / calories) * 100),
            f: Math.round(((sum.f * 9) / calories) * 100),
          }
        : { p: 0, c: 0, f: 0 };

    return { protein: sum.p, carbs: sum.c, fat: sum.f, calories, pct };
  }, [items]);

  return { items, addPreset, addCustom, updateQty, remove, clearAll, totals };
}
