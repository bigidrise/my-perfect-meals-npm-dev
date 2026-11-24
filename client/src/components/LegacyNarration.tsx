import type { ReactNode } from "react";
import { LEGACY_CHEF_NARRATION_ENABLED } from "@shared/legacyNarration";

/** Unmount narration-only UI, including its spacing and playback effects. */
export function LegacyNarration({ children }: { children: ReactNode }) {
  return LEGACY_CHEF_NARRATION_ENABLED ? <>{children}</> : null;
}
