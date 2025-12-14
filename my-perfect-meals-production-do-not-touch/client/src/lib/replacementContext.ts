// Tiny helper to pass "replace this meal" intent between pages.
const KEY = "replaceCtx";

export type ReplaceCtx = {
  weekKey: string;
  mealId: string;
  dayIndex: number;
  mealType: string;
};

export const setReplaceCtx = (ctx: ReplaceCtx) => localStorage.setItem(KEY, JSON.stringify(ctx));
export const getReplaceCtx = (): ReplaceCtx | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const clearReplaceCtx = () => localStorage.removeItem(KEY);