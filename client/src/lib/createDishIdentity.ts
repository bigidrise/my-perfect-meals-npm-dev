export type DishWithIdentity = {
  id?: string | null;
  name?: string;
};

export function normalizeCreateDishOptions<T extends DishWithIdentity>(
  dishes: T[],
  generationKey: string,
): Array<T & { id: string }> {
  const usedIds = new Set<string>();
  return dishes.map((dish, index) => {
    const candidate = typeof dish.id === "string" ? dish.id.trim() : "";
    let id = candidate && !usedIds.has(candidate)
      ? candidate
      : `create-dish-${generationKey}-${index + 1}`;
    let collisionIndex = 1;
    while (usedIds.has(id)) {
      id = `create-dish-${generationKey}-${index + 1}-${collisionIndex}`;
      collisionIndex += 1;
    }
    usedIds.add(id);
    return { ...dish, id };
  });
}

export function selectCreateDishById<T extends { id: string }>(
  dishes: readonly T[],
  selectedDishId: string | null,
): T | null {
  if (!selectedDishId) return null;
  return dishes.find((dish) => dish.id === selectedDishId) ?? null;
}

export function getCreateDishAlternatives<T extends { id: string }>(
  dishes: readonly T[],
  selectedDishId: string | null,
): T[] {
  if (!selectedDishId) return [...dishes];
  return dishes.filter((dish) => dish.id !== selectedDishId);
}

export function shouldApplyCreateDishResponse(
  activeRequestId: number,
  responseRequestId: number,
): boolean {
  return activeRequestId === responseRequestId;
}