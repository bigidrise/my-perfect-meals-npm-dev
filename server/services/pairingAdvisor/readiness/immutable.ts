/** Inputs are bounded JSON contracts; never freeze or mutate a caller's object. */
export function immutableCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}
