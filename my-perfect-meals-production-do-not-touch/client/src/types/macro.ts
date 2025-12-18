export type MacroItem = {
  id: string;
  name: string;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  qty: number; // servings multiplier
};

export type Preset = Omit<MacroItem, "qty"> & { qty?: number };
