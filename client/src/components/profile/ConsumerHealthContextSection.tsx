import type { ReactNode } from "react";

// Keep the review UI implemented, but out of the consumer product until explicitly reopened.
export const CONSUMER_HEALTH_CONTEXT_VISIBLE = false;

export function ConsumerHealthContextSection({ children }: { children: ReactNode }) {
  if (!CONSUMER_HEALTH_CONTEXT_VISIBLE) return null;
  return <>{children}</>;
}