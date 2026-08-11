/**
 * Coaching Engine — Observer Registry & Runner (Phase 3)
 *
 * Phase 3 replaced all stubs with real Observer implementations.
 * This file now serves as the central registry and runner only.
 *
 * Each Observer is in its own file with full provenance documentation.
 * See docs/coaching-engine/observer-coverage-audit.md for the full
 * SUPPORTED / PARTIALLY OBSERVABLE / NOT YET OBSERVABLE audit.
 */

import type {
  ObserverOutput,
  ObserverConfig,
  CoachSubject,
} from "../../../../shared/coaching/types";

// ─── Real Observer Implementations ───────────────────────────────────────────

import { weightObserver }     from "./weightObserver";
import { macroObserver }      from "./macroObserver";
import { hydrationObserver }  from "./hydrationObserver";
import { exerciseObserver }   from "./exerciseObserver";
import { restaurantObserver } from "./restaurantObserver";
import { behaviorObserver }   from "./behaviorObserver";
import { lifestyleObserver }  from "./lifestyleObserver";
import { complianceObserver } from "./complianceObserver";

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ALL_OBSERVERS: Record<
  string,
  ObserverConfig & { run(subject: CoachSubject): Promise<ObserverOutput> }
> = {
  weight:     weightObserver,
  macro:      macroObserver,
  hydration:  hydrationObserver,
  exercise:   exerciseObserver,
  restaurant: restaurantObserver,
  behavior:   behaviorObserver,
  lifestyle:  lifestyleObserver,
  compliance: complianceObserver,
};

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Run selected Observers for a given subject.
 * Observers run sequentially (not parallel) to avoid DB connection pool
 * saturation on conversations with many observers selected.
 * Each Observer failure is non-fatal — the engine continues with remaining outputs.
 */
export async function runObservers(
  observerIds: string[],
  subject: CoachSubject
): Promise<ObserverOutput[]> {
  const results: ObserverOutput[] = [];
  for (const id of observerIds) {
    const observer = ALL_OBSERVERS[id];
    if (!observer) {
      console.warn(`[Observers] Unknown observer ID: ${id} — skipping`);
      continue;
    }
    try {
      const output = await observer.run(subject);
      // Auto-tag every Evidence item with the observer ID so confidence.ts
      // and patternMatcher.ts can filter by e.observer without each observer
      // having to repeat its own ID on every finding.
      output.findings = output.findings.map((f) =>
        f.observer ? f : { ...f, observer: id }
      );
      results.push(output);
    } catch (err: any) {
      console.error(`[Observers] Observer ${id} failed:`, err.message);
      // Non-fatal — continue with remaining observers
    }
  }
  return results;
}

// ─── Selector ─────────────────────────────────────────────────────────────────

/**
 * Select which Observers to run based on detected intent.
 * Filters by what the specialization adapter declares as supported.
 *
 * Compliance Observer always runs — it gates evidence confidence.
 */
export function selectObservers(
  intent: string,
  supportedObservers: string[]
): string[] {
  const intentToObservers: Record<string, string[]> = {
    rapid_weight_gain:   ["weight", "macro", "hydration", "lifestyle", "compliance"],
    weight_loss_plateau: ["weight", "macro", "restaurant", "exercise", "compliance"],
    fatigue_low_energy:  ["macro", "hydration", "exercise", "lifestyle", "compliance"],
    cravings:            ["macro", "behavior", "lifestyle", "hydration", "compliance"],
    restaurant_eating:   ["restaurant", "macro", "lifestyle", "compliance"],
    general_inquiry:     ["weight", "macro", "hydration", "behavior", "lifestyle", "compliance"],
  };

  // Always include compliance; fall back to general if intent not mapped
  const base = intentToObservers[intent] ?? intentToObservers["general_inquiry"];
  const withCompliance = Array.from(new Set([...base, "compliance"]));

  // Filter to only observers the specialization supports
  return withCompliance.filter((id) => supportedObservers.includes(id));
}
