// client/src/lib/mealRules.ts
import type { Targets } from "@/lib/proData";

export function applyCarbDirectives(
  day: { starchyG: number; fibrousG: number; addedSugarG: number },
  t: Targets,
) {
  const dir = t.carbDirective || {};
  const capped = { ...day };

  if (dir.starchyCapG != null) {
    capped.starchyG = Math.min(capped.starchyG, dir.starchyCapG);
  }
  if (dir.addedSugarCapG != null) {
    capped.addedSugarG = Math.min(capped.addedSugarG, dir.addedSugarCapG);
  }
  if (dir.fibrousFloorG != null) {
    capped.fibrousG = Math.max(capped.fibrousG, dir.fibrousFloorG);
  }
  return capped;
}
