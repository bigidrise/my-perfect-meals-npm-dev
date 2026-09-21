export type RememberedChildSelection = {
  activeChildId: string | null;
  shouldClearRememberedId: boolean;
};

export function reconcileRememberedChildSelection(
  rememberedId: string | null,
  authorizedChildIds: readonly string[],
  generalSentinel: string,
): RememberedChildSelection {
  if (rememberedId === generalSentinel) {
    return {
      activeChildId: generalSentinel,
      shouldClearRememberedId: false,
    };
  }

  if (rememberedId && authorizedChildIds.includes(rememberedId)) {
    return {
      activeChildId: rememberedId,
      shouldClearRememberedId: false,
    };
  }

  return {
    activeChildId: authorizedChildIds[0] ?? null,
    shouldClearRememberedId: Boolean(rememberedId),
  };
}

export function resolveRememberedProfileId(
  rememberedId: string | null,
  authorizedChildIds: readonly string[],
  generalSentinel: string,
): string | null {
  if (!rememberedId || rememberedId === generalSentinel) return null;
  return authorizedChildIds.includes(rememberedId) ? rememberedId : null;
}