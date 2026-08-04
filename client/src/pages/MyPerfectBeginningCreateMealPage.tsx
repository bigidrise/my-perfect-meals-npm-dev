/**
 * My Perfect Beginning — Create a Meal page wrapper
 *
 * Placeholder entry point. The full recipe generator is built in the
 * My Perfect Beginning hub (MyPerfectBeginningPage). This route exists
 * as a deep-link target for the Create a Meal section card.
 */

import { useLocation } from "wouter";
import { useEffect } from "react";

export default function MyPerfectBeginningCreateMealPage() {
  const [, setLocation] = useLocation();

  // Redirect to the hub — the create-meal flow lives there in Phase 1
  useEffect(() => {
    setLocation("/lifestyle/my-perfect-beginning", { replace: true });
  }, [setLocation]);

  return null;
}
