let scrollTarget: string | null = null;

export function setScrollTarget(id: string) {
  scrollTarget = id;
}

export function consumeScrollTarget(): string | null {
  const target = scrollTarget;
  scrollTarget = null;
  return target;
}
