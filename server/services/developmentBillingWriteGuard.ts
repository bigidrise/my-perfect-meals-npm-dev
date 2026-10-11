import {
  developmentStripeIsolated, DevelopmentStripeIsolationError,
} from "./developmentStripeIsolation";

const financialTable = /(?:^stripe_|billing|checkout|subscription|payment|invoice)|^(?:partner_promotions|promotion_redemptions)$/;
const userBillingColumn = /\b(?:(?:studio_|personal_)?(?:stripe_\w+|subscription_\w+|plan_lookup_key|entitlements))\b/;
const businessBillingColumn = /\b(?:stripe_\w+|subscription_\w+|cancel_at_period_end|paid_through|current_period_end)\b/;
const guarded = new WeakSet<object>();

function codeOnly(text: string): string {
  // Keep identifiers, remove comments and literal data from classification.
  return text.replace(/'(?:''|\\.|[^'])*'/g, "''")
    .replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ")
    .replace(/"/g, "").toLowerCase();
}

function freeOrganizationMode(text: string, values: readonly unknown[], operation: string): boolean {
  let token: string | undefined;
  if (operation.startsWith("insert")) {
    const match = text.match(/\binsert\s+into\s+(?:public\.)?businesses\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (match) {
      const columns = match[1].split(",").map(column => column.trim().toLowerCase());
      token = match[2].split(",")[columns.indexOf("commercial_access_mode")]?.trim();
    }
  } else {
    token = text.match(/\bcommercial_access_mode\s*=\s*(\$\d+|'(?:''|[^'])*')/i)?.[1];
  }
  const value = token?.startsWith("$") ? values[Number(token.slice(1)) - 1]
    : token?.replace(/^'|'$/g, "");
  return value === "onboarding_pilot" || value === "business_pilot";
}

function inertBillingDefaults(text: string, values: readonly unknown[], pattern: RegExp): boolean {
  const match = text.replace(/"/g, "").match(/\binsert\s+into\s+(?:public\.)?(?:users|businesses)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
  if (!match) return false;
  const columns = match[1].split(",").map(column => column.trim().toLowerCase());
  const tokens = match[2].split(",").map(token => token.trim());
  if (columns.length !== tokens.length) return false;
  return columns.every((column, index) => {
    if (!pattern.test(column)) return true;
    const token = tokens[index];
    return /^(?:default|null)$/i.test(token)
      || /^\$\d+$/.test(token) && values[Number(token.slice(1)) - 1] === null;
  });
}

export function assertNoDevelopmentBillingWrite(text: string, values: readonly unknown[] = []): void {
  if (!developmentStripeIsolated()) return;
  const code = codeOnly(text);
  const reject = () => { throw new DevelopmentStripeIsolationError(); };
  // Opaque procedural/dynamic SQL cannot be classified safely.
  if (/(?:^|;)\s*(?:call|do|execute|merge|truncate|alter|drop|create)\b/.test(code)) reject();
  const mutations = [...code.matchAll(/\b(update|insert\s+into|delete\s+from|truncate(?:\s+table)?|alter\s+table|drop\s+table|create\s+table)\s+(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?((?:[\w$]+\.)?[\w$]+)/g)];
  for (const match of mutations) {
    const operation = match[1];
    const table = match[2].split(".").pop()!;
    if (financialTable.test(table)) reject();
    if (table !== "users" && table !== "businesses") continue;
    // Parent deletion/DDL could mutate financial children through cascades/FKs.
    if (!operation.startsWith("update") && !operation.startsWith("insert")) reject();
    const statement = code.slice(match.index).split(";")[0];
    // An upsert could hide paid assignments outside the INSERT column list.
    // Free canonical-workspace upserts on nonfinancial tables remain allowed.
    if (operation.startsWith("insert") && /\bon\s+conflict\b[\s\S]*\bdo\s+update\b/.test(statement)) reject();
    const writeArea = operation.startsWith("update")
      ? statement.split(/\bset\b/)[1]?.split(/\bwhere\b|\breturning\b/)[0] ?? ""
      : statement.split(/\bvalues\b/)[0];
    if (table === "users" && userBillingColumn.test(writeArea)
        && !(operation.startsWith("insert") && inertBillingDefaults(text, values, userBillingColumn))) reject();
    if (table === "businesses") {
      if (businessBillingColumn.test(writeArea)
          && !(operation.startsWith("insert") && inertBillingDefaults(text, values, businessBillingColumn))) reject();
      if (/\b(?:commercial_access_mode|status)\b/.test(writeArea)) {
        if (!freeOrganizationMode(text.replace(/"/g, ""), values, operation)) reject();
      }
    }
  }
}

/**
 * Install before Drizzle sees the pool; also guard checked-out transaction
 * clients. Callback-style rejection is asynchronous, like node-postgres.
 * There is no SQL/parameter logging and no query reaches pg on rejection.
 */
export function installDevelopmentBillingWriteGuard(target: any): void {
  if (!developmentStripeIsolated() || guarded.has(target)) return;
  guarded.add(target);
  const original = target.query;
  const prepared = new Map<string, string>();
  target.query = function (...args: any[]) {
    const config = args[0];
    const text = typeof config === "string" ? config
      : config?.text ?? prepared.get(config?.name);
    const values = Array.isArray(args[1]) ? args[1] : config?.values ?? [];
    try {
      if (typeof text !== "string") throw new DevelopmentStripeIsolationError();
      assertNoDevelopmentBillingWrite(text, values);
      if (config?.name) prepared.set(config.name, text);
    } catch (error) {
      const callback = args.slice().reverse().find((arg: unknown) => typeof arg === "function");
      if (callback) { queueMicrotask(() => callback(error)); return; }
      return Promise.reject(error);
    }
    return original.apply(this, args);
  };
}
