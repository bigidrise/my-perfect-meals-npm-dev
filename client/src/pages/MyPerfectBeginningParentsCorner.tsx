/**
 * My Perfect Beginning — Parent's Corner page wrapper
 *
 * Thin page entry point that renders ParentsCorner with an empty child
 * context. Once the Child Nutrition Profile (task #294) and hub (task #289)
 * are wired up, this can accept the active profile via route state or a
 * shared context provider.
 */

import { Suspense } from "react";
import ParentsCorner from "@/components/my-perfect-beginning/ParentsCorner";

export default function MyPerfectBeginningParentsCornerPage() {
  return (
    <Suspense fallback={null}>
      <ParentsCorner />
    </Suspense>
  );
}
