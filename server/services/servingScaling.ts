function parseQuantity(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0
      ? Number(mixed[1]) + Number(mixed[2]) / denominator
      : null;
  }
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function scaleIngredientQuantity(
  quantity: unknown,
  servings: number,
): string | unknown {
  const parsed = parseQuantity(quantity);
  if (parsed == null) return quantity;
  return String(parsed * servings);
}