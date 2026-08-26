export const STUDIO_MESSAGE_NEAR_BOTTOM_PX = 48;

export function isStudioMessageListNearBottom(
  element: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= STUDIO_MESSAGE_NEAR_BOTTOM_PX;
}

export function getStudioMessageScrollDecision(input: {
  initialLoad: boolean;
  wasNearBottom: boolean;
  previousMessageIds: readonly string[] | null;
  messageIds: readonly string[];
}): { scrollToBottom: boolean; showNewMessageIndicator: boolean } {
  if (input.initialLoad) {
    return {
      scrollToBottom: input.messageIds.length > 0,
      showNewMessageIndicator: false,
    };
  }

  const previous = new Set(input.previousMessageIds ?? []);
  const hasNewMessage = input.messageIds.some((id) => !previous.has(id));
  if (!hasNewMessage) {
    return { scrollToBottom: false, showNewMessageIndicator: false };
  }

  return {
    scrollToBottom: input.wasNearBottom,
    showNewMessageIndicator: !input.wasNearBottom,
  };
}