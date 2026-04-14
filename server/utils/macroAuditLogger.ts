/**
 * MACRO AUDIT LOGGER
 *
 * Temporary rollout diagnostic tool.
 * Logs macro values at 5 key checkpoints in the generation pipeline.
 *
 * Enable by setting: MACRO_AUDIT=true in environment variables.
 * Disable in production by unsetting MACRO_AUDIT.
 *
 * Checkpoints:
 *   1. prompt_sent      — the system prompt sent to the AI
 *   2. ai_raw           — the raw nutrition object returned by the AI
 *   3. post_processing  — nutrition values after pipeline transformations
 *   4. api_payload      — the final object being returned to the client
 *   5. cache            — cache read or write decision
 */

const ENABLED = process.env.MACRO_AUDIT === "true";

type Checkpoint =
  | "prompt_sent"
  | "ai_raw"
  | "post_processing"
  | "api_payload"
  | "cache";

interface MacroSnapshot {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  starchyCarbs?: number | null;
  fibrousCarbs?: number | null;
}

/**
 * Log a macro snapshot at a pipeline checkpoint.
 *
 * @param checkpoint - which stage of the pipeline
 * @param mealName   - name or identifier of the meal being generated
 * @param macros     - the macro values at this checkpoint
 * @param meta       - optional context (diet, builder, cache hit/miss, etc.)
 */
export function macroAudit(
  checkpoint: Checkpoint,
  mealName: string,
  macros: MacroSnapshot,
  meta?: Record<string, unknown>
): void {
  if (!ENABLED) return;

  const nullFields = Object.entries(macros)
    .filter(([, v]) => v === null || v === undefined)
    .map(([k]) => k);

  const invented = Object.entries(macros)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${k}=${v}`);

  const tag = nullFields.length > 0
    ? `⚠️  UNKNOWN: [${nullFields.join(", ")}]`
    : "✅ all macros present";

  console.log(
    `[MACRO_AUDIT][${checkpoint}] "${mealName}" | ${tag}`,
    {
      macros,
      ...(meta ? { meta } : {}),
    }
  );

  if (nullFields.includes("carbs") || nullFields.includes("starchyCarbs")) {
    console.warn(
      `[MACRO_AUDIT][${checkpoint}] ⚠️  carbs are null/unknown for "${mealName}" — no fallback will be invented`
    );
  }
}

/**
 * Log the system prompt being sent to the AI.
 * Only logs the first 500 chars to keep output readable.
 */
export function macroAuditPrompt(
  mealName: string,
  systemPrompt: string,
  meta?: Record<string, unknown>
): void {
  if (!ENABLED) return;

  const hasBaseline = systemPrompt.includes("MANDATORY") ||
    systemPrompt.includes("minimum targets") ||
    systemPrompt.includes("BASELINE MACRO");

  console.log(
    `[MACRO_AUDIT][prompt_sent] "${mealName}" | baseline injected: ${hasBaseline}`,
    {
      promptPreview: systemPrompt.slice(0, 500) + (systemPrompt.length > 500 ? "…" : ""),
      ...(meta ? { meta } : {}),
    }
  );

  if (hasBaseline) {
    console.warn(
      `[MACRO_AUDIT][prompt_sent] ⚠️  baseline macro injection detected in prompt for "${mealName}"`
    );
  }
}

/**
 * Log a cache decision.
 */
export function macroAuditCache(
  mealName: string,
  decision: "hit" | "miss" | "write",
  cacheKey: string,
  macros?: MacroSnapshot
): void {
  if (!ENABLED) return;

  console.log(
    `[MACRO_AUDIT][cache] "${mealName}" | ${decision.toUpperCase()} | key: ${cacheKey}`,
    macros ? { macros } : {}
  );
}
