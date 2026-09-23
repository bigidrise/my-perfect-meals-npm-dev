import type { OneTouchDirection } from "@shared/oneTouch";

export type OneTouchFailureClass = "technical_provider" | "authority";

export interface CompleteOneTouchMealsInput<T> {
  directions: OneTouchDirection[];
  targetCount?: 1 | 2 | 3;
  /** Generates replacement directions. It is called only after the current queue is exhausted. */
  generateDirections: (input: {
    requestedCount: number;
    attempt: number;
    accepted: OneTouchDirection[];
  }) => Promise<OneTouchDirection[]>;
  /** Canonical invocation and acceptance. A false result is an authority rejection. */
  canonicalAccept: (direction: OneTouchDirection) => Promise<
    boolean | { accepted: boolean; value?: T; failureClass?: OneTouchFailureClass }
  >;
}

export interface CompleteOneTouchMealsResult<T> {
  accepted: Array<{ direction: OneTouchDirection; value?: T }>;
  attemptsCompleted: number;
}

/**
 * Runs the canonical meal path with a bounded queue. Directions that pass are
 * retained; replacements are requested in exact missing-count batches only
 * after every queued direction has been tried.
 */
export async function completeOneTouchMeals<T>(
  input: CompleteOneTouchMealsInput<T>,
): Promise<CompleteOneTouchMealsResult<T>> {
  const targetCount = input.targetCount ?? 3;
  if (targetCount < 1 || targetCount > 3) throw new Error("ONE_TOUCH_INVALID_TARGET_COUNT");
  const accepted: Array<{ direction: OneTouchDirection; value?: T }> = [];
  let queue = input.directions.slice();
  let attemptsCompleted = 0;
  const failures: OneTouchFailureClass[] = [];

  while (attemptsCompleted < 5 && accepted.length < targetCount) {
    while (queue.length && attemptsCompleted < 5 && accepted.length < targetCount) {
      const direction = queue.shift()!;
      attemptsCompleted += 1;
      try {
        const result = await input.canonicalAccept(direction);
        const normalized = typeof result === "boolean" ? { accepted: result } : result;
        if (normalized.accepted && !accepted.some((item) => item.direction.title === direction.title)) {
          accepted.push({ direction, value: normalized.value });
        } else if (!normalized.accepted) {
          failures.push(normalized.failureClass ?? "authority");
        }
      } catch (error) {
        if (error && typeof error === "object" && "oneTouchStop" in error) throw error;
        failures.push("technical_provider");
      }
    }
    if (accepted.length >= targetCount || attemptsCompleted >= 5) break;
    const requestedCount = targetCount - accepted.length;
    try {
      const replacements = await input.generateDirections({
        requestedCount,
        attempt: attemptsCompleted,
        accepted: accepted.map((item) => item.direction),
      });
      // A provider that returns no work cannot make progress; do not spin or
      // silently turn that into a partial result.
      if (!replacements.length) break;
      queue = replacements;
    } catch {
      failures.push("technical_provider");
      break;
    }
  }

  if (accepted.length !== targetCount) {
    const error = new Error(
      failures.includes("authority")
        ? "We couldn't safely complete the requested meals."
        : "We couldn't finish creating the requested meals this time.",
    );
    Object.assign(error, {
      code: failures.includes("authority")
        ? "ONE_TOUCH_AUTHORITY_COMPLETION_FAILED"
        : "ONE_TOUCH_PROVIDER_INCOMPLETE",
      failureClass: failures.includes("authority") ? "authority" : "technical_provider",
      accepted,
      attemptsCompleted,
      missingCount: targetCount - accepted.length,
    });
    throw error;
  }
  return { accepted, attemptsCompleted };
}