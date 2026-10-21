import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";
import { developmentSnackRepairEnabled } from "../snackCompatibilityRepair";
import type { DessertDiagnostic } from "./dessertDiagnostics";

export class DevelopmentNoSaveError extends Error {
  constructor(public readonly code: string, public readonly status = 409) {
    super("The Development no-save test could not run safely.");
  }
}

interface ReadOnlyState {
  query: PoolClient["query"];
  closed: boolean;
  blockedWriteCount: number;
  suppressedPrescriptionWrites: number;
}

const execution = new AsyncLocalStorage<ReadOnlyState>();
const installed = new WeakSet<Pool>();

function deny(state: ReadOnlyState): never {
  state.blockedWriteCount++;
  throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED");
}

/** Suppress only materialization, never calculation or validation of targets. */
export function suppressDevelopmentTestPrescriptionWrite(): boolean {
  const state = execution.getStore();
  if (!state) return false;
  state.suppressedPrescriptionWrites++;
  return true;
}

export function assertNoDevelopmentTestWrites(): void {
  const state = execution.getStore();
  if (state?.blockedWriteCount) {
    throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED");
  }
}

/**
 * Redirect this request's existing Drizzle/pool reads to one READ ONLY
 * transaction. Other requests retain the original pool behavior. Do not allow
 * nested connection acquisition or SQL that can end/reconfigure the transaction.
 */
function installRouting(pool: Pool): void {
  if (installed.has(pool)) return;
  installed.add(pool);
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  // Proxy preserves pg's overloads, receiver, callbacks and stream return values.
  // Unknown values are narrowed at this reflection boundary, never cast to an
  // invented query signature.
  pool.query = new Proxy(originalQuery, {
    apply(target, receiver: unknown, args: unknown[]) {
      const state = execution.getStore();
      if (!state) return Reflect.apply(target, receiver, args);
      try {
        if (state.closed) deny(state);
        const query = args[0];
        const text = typeof query === "string" ? query
          : query !== null && typeof query === "object" && "text" in query
            ? query.text : undefined;
        const code = typeof text === "string"
          ? text.replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").trim()
          : "";
        if (!/^(select|with|show)\b/i.test(code) || /;/.test(code.replace(/;\s*$/, "")) ||
          /\b(insert|update|delete|merge|call|copy|create|alter|drop|truncate)\b/i.test(code)) {
          deny(state);
        }
        let recorded = false;
        const observe = (error: unknown) => {
          if (!recorded && error !== null && typeof error === "object"
            && "code" in error && error.code === "25006") {
            recorded = true;
            state.blockedWriteCount++;
          }
        };
        const forwarded = [...args];
        const callback = forwarded[forwarded.length - 1];
        if (typeof callback === "function") {
          forwarded[forwarded.length - 1] = new Proxy(callback, {
            apply(target, receiver: unknown, callbackArgs: unknown[]) {
              observe(callbackArgs[0]);
              return Reflect.apply(target, receiver, callbackArgs);
            },
          });
        }
        const result: unknown = Reflect.apply(state.query, undefined, forwarded);
        if (result !== null && typeof result === "object" &&
          "catch" in result && typeof result.catch === "function") {
          return Reflect.apply(result.catch, result, [(error: unknown) => {
            observe(error);
            throw error;
          }]);
        }
        return result;
      } catch (error) {
        const callback = args[args.length - 1];
        if (typeof callback === "function") {
          return queueMicrotask(() => Reflect.apply(callback, undefined, [error]));
        }
        return Promise.reject(error);
      }
    },
  });
  pool.connect = new Proxy(originalConnect, {
    apply(target, receiver: unknown, args: unknown[]) {
      const state = execution.getStore();
      if (!state) return Reflect.apply(target, receiver, args);
      try {
        deny(state);
      } catch (error) {
        const callback = args[0];
        if (typeof callback === "function") {
          return queueMicrotask(() => Reflect.apply(callback, undefined, [error]));
        }
        return Promise.reject(error);
      }
    },
  });
}

export async function withDevelopmentNoSaveDatabase<T>(
  pool: Pool,
  operation: (state: Readonly<Pick<ReadOnlyState, "blockedWriteCount" | "suppressedPrescriptionWrites">>) => Promise<T>,
): Promise<T> {
  if (!developmentSnackRepairEnabled()) {
    throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_UNAVAILABLE", 404);
  }
  if (execution.getStore()) throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_NESTED");
  installRouting(pool);
  const client = await pool.connect();
  const state: ReadOnlyState = {
    query: client.query.bind(client),
    closed: false, blockedWriteCount: 0, suppressedPrescriptionWrites: 0,
  };
  try {
    await client.query("BEGIN READ ONLY");
    return await execution.run(state, () => operation(state));
  } finally {
    // Detached work must never use a released connection after the rollback.
    state.closed = true;
    let discard = false;
    try { await client.query("ROLLBACK"); } catch { discard = true; }
    client.release(discard);
  }
}

/** One live generation invocation per Development process, not an AI retry loop. */
export function createDevelopmentDessertTestClaim(): () => void {
  let used = false;
  return () => {
    if (!developmentSnackRepairEnabled()) {
      throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_UNAVAILABLE", 404);
    }
    if (used) throw new DevelopmentNoSaveError("DEVELOPMENT_DESSERT_TEST_ALREADY_USED", 429);
    used = true;
  };
}

export function createDevelopmentDessertTestDiagnostics() {
  let completion: DessertDiagnostic | undefined;
  let displayDescriptionRecoveryCount = 0;
  const schemaIssues: Record<string, number> = {};
  const comparisonBranches: Record<string, number> = {};
  return {
    capture(event: DessertDiagnostic) {
      if (event.stage === "completion") completion = event;
      if (event.displayDescriptionRecovered) displayDescriptionRecoveryCount++;
      for (const issue of event.issues ?? []) {
        if (issue.phase !== "after") continue;
        const key = `${issue.path}:${issue.rule}`;
        schemaIssues[key] = (schemaIssues[key] ?? 0) + 1;
      }
      if (event.stage === "comparison" && event.branch) {
        comparisonBranches[event.branch] = (comparisonBranches[event.branch] ?? 0) + 1;
      }
    },
    summary() {
      return {
        noSave: true, saved: false,
        acceptedCount: completion?.acceptedCount ?? 0,
        generationRounds: completion?.attempt ?? 0,
        candidateCount: completion?.candidateCount ?? 0,
        rejectedCount: completion?.rejectedCount ?? 0,
        rejectionCategories: completion?.rejectionCounts ?? {},
        providerFailureCount: completion?.providerFailureCount ?? 0,
        displayDescriptionRecoveryCount,
        schemaIssues, comparisonBranches,
      };
    },
  };
}
