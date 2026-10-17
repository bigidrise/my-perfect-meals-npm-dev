import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool } from "pg";
import { developmentSnackRepairEnabled } from "../snackCompatibilityRepair";
import type { DessertDiagnostic } from "./dessertDiagnostics";

export class DevelopmentNoSaveError extends Error {
  constructor(public readonly code: string, public readonly status = 409) {
    super("The Development no-save test could not run safely.");
  }
}

interface ReadOnlyState {
  query: Pool["query"];
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
  pool.query = function (...args: any[]) {
    const state = execution.getStore();
    if (!state) return originalQuery.apply(this, args);
    try {
      if (state.closed) deny(state);
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
      const code = typeof text === "string"
        ? text.replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").trim()
        : "";
      if (!/^(select|with|show)\b/i.test(code) || /;/.test(code.replace(/;\s*$/, "")) ||
        /\b(insert|update|delete|merge|call|copy|create|alter|drop|truncate)\b/i.test(code)) {
        deny(state);
      }
      const result = (state.query as (...queryArgs: unknown[]) => unknown)(...args);
      if (result && typeof (result as { catch?: unknown }).catch === "function") {
        return (result as Promise<unknown>).catch((error: { code?: string }) => {
          if (error?.code === "25006") state.blockedWriteCount++;
          throw error;
        });
      }
      return result;
    } catch (error) {
      const callback = args[args.length - 1];
      if (typeof callback === "function") return queueMicrotask(() => callback(error));
      return Promise.reject(error);
    }
  } as Pool["query"];
  pool.connect = function (...args: any[]) {
    const state = execution.getStore();
    if (!state) return originalConnect.apply(this, args);
    try {
      deny(state);
    } catch (error) {
      if (typeof args[0] === "function") return queueMicrotask(() => args[0](error));
      return Promise.reject(error);
    }
  } as Pool["connect"];
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
    query: client.query.bind(client) as Pool["query"],
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
